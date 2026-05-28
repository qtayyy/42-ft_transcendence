import { PrismaClient } from "../../generated/prisma/index.js";
import fp from "fastify-plugin";
import crypto from "crypto";
import TournamentManager, {
  activeTournaments,
} from "../../game/TournamentManager.js";
import { safeSend } from "../../utils/ws-utils.js";
import {
  REMOTE_SINGLE_PLAYER_COUNT,
  REMOTE_TOURNAMENT_MAX_PLAYERS,
  REMOTE_TOURNAMENT_MIN_PLAYERS,
  assertRemoteRoomCanStartTournament,
  normalizeRemoteMatchmakingMode,
  normalizeRemotePlayerCount,
  normalizeRemoteRoomId,
  normalizeRemoteRoomOptions,
  normalizeRemoteTournamentPlayers,
  normalizeRemoteTournamentId,
  normalizeRemoteUserId,
  normalizeRemoteUsername,
} from "../../lib/remote-play-validation.js";

const prisma = new PrismaClient();

export default fp((fastify) => {
  const resolveRoomMembership = (userId) => {
    const numericUserId = Number(userId);
    const mappedRoomId = fastify.currentRoom.get(numericUserId);
    if (!mappedRoomId) return null;

    const mappedRoom = fastify.gameRooms.get(mappedRoomId);
    if (!mappedRoom) {
      fastify.currentRoom.delete(numericUserId);
      return null;
    }

    const isJoined = mappedRoom.joinedPlayers.some(
      (p) => Number(p.id) === numericUserId,
    );
    const isInvited = mappedRoom.invitedPlayers.some(
      (p) => Number(p.id) === numericUserId,
    );

    // If map points to a room that doesn't actually reference this user, clear stale entry.
    if (!isJoined && !isInvited) {
      fastify.currentRoom.delete(numericUserId);
      return null;
    }

    // If user is alone in a pre-game room, treat it as abandoned and release them.
    if (
      isJoined &&
      Number(mappedRoom.hostId) === numericUserId &&
      mappedRoom.joinedPlayers.length <= 1 &&
      !mappedRoom.tournamentStarted
    ) {
      fastify.currentRoom.delete(numericUserId);
      fastify.gameRooms.delete(mappedRoomId);
      return null;
    }

    return mappedRoomId;
  };

  const hasOnlineJoinedPlayer = (room) =>
    room?.joinedPlayers?.some((player) => {
      const sockets = fastify.onlineUsers.get(Number(player.id));
      return sockets instanceof Set ? sockets.size > 0 : Boolean(sockets);
    }) || false;

  const removeRoomMembershipMappings = (roomId, room) => {
    room?.joinedPlayers?.forEach((player) => {
      if (fastify.currentRoom.get(Number(player.id)) === roomId) {
        fastify.currentRoom.delete(Number(player.id));
      }
    });
  };

  fastify.decorate(
    "createGameRoom",
    (hostId, hostUsername, maxPlayers, isPublic = false, isTournament = false) => {
      const numericHostId = normalizeRemoteUserId(hostId, "Host ID");
      const safeHostUsername = normalizeRemoteUsername(hostUsername);
      const roomOptions = normalizeRemoteRoomOptions(maxPlayers, isTournament);

//       console.log(`[CREATE_ROOM_START] hostId: ${numericHostId} (${safeHostUsername})`);
      const roomId = crypto.randomUUID();

      fastify.currentRoom.set(numericHostId, roomId);
//       console.log(
//         `[CREATE_ROOM_MAP] currentRoom.set(${numericHostId}, ${roomId})`,
//       );

      const roomState = {
        hostId: numericHostId,
        invitedPlayers: [],
        joinedPlayers: [{ id: numericHostId, username: safeHostUsername }],
        maxPlayers: roomOptions.maxPlayers,
        isPublic: Boolean(isPublic),
        isTournament: roomOptions.isTournament,
        tournamentStarted: false,
        createdAt: Date.now(),
      };
      fastify.gameRooms.set(roomId, roomState);
//       console.log(
//         `[CREATE_ROOM_MAP] gameRooms.set(${roomId}, ${JSON.stringify(roomState)})`,
//       );

      return roomId;
    },
  );

  fastify.decorate("sendGameRoom", (userId) => {
    const numericUserId = Number(userId);
//     console.log(`[SEND_ROOM_START] userId: ${numericUserId}`);

    let roomId = fastify.currentRoom.get(numericUserId);
//     console.log(
//       `[SEND_ROOM_GET] currentRoom.get(${numericUserId}) -> ${roomId}`,
//     );

    if (!roomId) {
//       console.log(
//         `[SEND_ROOM_FALLBACK] Searching all rooms for player ${numericUserId}...`,
//       );
      for (const [id, room] of fastify.gameRooms.entries()) {
        const isJoined = room.joinedPlayers.some(
          (p) => Number(p.id) === numericUserId,
        );
        if (isJoined) {
          roomId = id;
          fastify.currentRoom.set(numericUserId, roomId);
//           console.log(
//             `[SEND_ROOM_RECOVERED] Found in room ${roomId}. Fixed map.`,
//           );
          break;
        }
      }
    }

    if (!roomId) {
//       console.log(
//         `[SEND_ROOM_NOT_FOUND] User ${numericUserId} has no active room.`,
//       );
      return;
    }

    const room = fastify.gameRooms.get(roomId);
    if (!room) {
      console.error(
        `[SEND_ROOM_DESYNC] currentRoom says ${roomId} but gameRooms is MISSING it!`,
      );
      fastify.currentRoom.delete(numericUserId);
      return;
    }

    const payload = {
      roomId,
      hostId: room.hostId,
      invitedPlayers: room.invitedPlayers,
      joinedPlayers: room.joinedPlayers,
      maxPlayers: room.maxPlayers,
      isTournament: room.isTournament || false,
      tournamentStarted: room.tournamentStarted || false,
    };

//     console.log(
//       `[SEND_ROOM_PAYLOAD] Sending to ${numericUserId}: ${JSON.stringify(payload)}`,
//     );
    const sockets = fastify.onlineUsers.get(numericUserId);
    safeSend(sockets, { event: "GAME_ROOM", payload }, numericUserId);
  });

  fastify.decorate(
    "sendGameInvite",
    (roomId, hostId, hostUsername, friendId, friendUsername) => {
      // Ensure IDs are numbers for consistent lookup
      const normalizedRoomId = normalizeRemoteRoomId(roomId);
      const numericFriendId = normalizeRemoteUserId(friendId, "Friend ID");
      const numericHostId = normalizeRemoteUserId(hostId, "Host ID");
      const safeHostUsername = normalizeRemoteUsername(hostUsername, "Host username");
      const safeFriendUsername = normalizeRemoteUsername(
        friendUsername,
        "Friend username",
      );

      const cleanupInviteRoomIfPending = () => {
        const room = fastify.gameRooms.get(normalizedRoomId);
        const hostSocket = fastify.onlineUsers.get(numericHostId);
        if (!room) {
          fastify.currentRoom.delete(numericHostId);
          safeSend(hostSocket, { event: "LEAVE_ROOM" }, numericHostId);
          return;
        }

        const hasOnlyHost =
          room.joinedPlayers.length <= 1 &&
          Number(room.hostId) === numericHostId;
        const hasNoPendingInvites = room.invitedPlayers.length === 0;
        if (hasOnlyHost && hasNoPendingInvites) {
          fastify.currentRoom.delete(numericHostId);
          fastify.gameRooms.delete(normalizedRoomId);
          safeSend(hostSocket, { event: "LEAVE_ROOM" }, numericHostId);
        }
      };

      const inviteeInRoom = resolveRoomMembership(numericFriendId);
      if (inviteeInRoom) {
        cleanupInviteRoomIfPending();
        throw new Error("Player already in another room");
      }

      // Reject invite if friend is not online (no open WS connection)
      const inviteeSocket = fastify.onlineUsers.get(numericFriendId);
      if (!inviteeSocket || inviteeSocket.size === 0) {
        // Clean up the room if it was only created for this pending invite.
        cleanupInviteRoomIfPending();
        throw new Error("Friend is not online");
      }

      const room = fastify.gameRooms.get(normalizedRoomId);
      if (!room) throw new Error("Room does not exist");

      const hostSocket = fastify.onlineUsers.get(numericHostId);
      const alreadyJoined = room.joinedPlayers.some(
        (p) => Number(p.id) === numericFriendId,
      );
      if (alreadyJoined) {
        safeSend(
          hostSocket,
          {
            event: "GAME_INVITE_PENDING",
            payload: {
              friendId: numericFriendId,
              friendUsername: safeFriendUsername,
              roomId: normalizedRoomId,
              reason: "already-joined",
            },
          },
          numericHostId,
        );
        return;
      }

      const alreadyInvited = room.invitedPlayers.some(
        (p) => Number(p.id) === numericFriendId,
      );
      if (alreadyInvited) {
        safeSend(
          hostSocket,
          {
            event: "GAME_INVITE_PENDING",
            payload: {
              friendId: numericFriendId,
              friendUsername: safeFriendUsername,
              roomId: normalizedRoomId,
              reason: "already-pending",
            },
          },
          numericHostId,
        );
        return;
      }

      room.invitedPlayers.push({
        id: numericFriendId,
        username: safeFriendUsername,
      });

      // Send game invite to invitee (socket already fetched above for online check)
      safeSend(
        inviteeSocket,
        {
          event: "GAME_INVITE",
          payload: {
            roomId: normalizedRoomId,
            hostId: numericHostId,
            hostUsername: safeHostUsername,
          },
        },
        numericFriendId,
      );

      // Persist invite in chat history so it survives page reloads.
      prisma.message
        .create({
          data: {
            senderId: numericHostId,
            recipientId: numericFriendId,
            content: `${safeHostUsername} invited you to join private room ${normalizedRoomId}`,
          },
        })
        .catch((err) => {
          console.error("Failed to persist room invite message:", err);
        });

      // Send updated game room to host
      const payload = {
        roomId: normalizedRoomId,
        hostId: room.hostId,
        invitedPlayers: room.invitedPlayers,
        joinedPlayers: room.joinedPlayers,
        maxPlayers: room.maxPlayers,
        isTournament: room.isTournament || false,
        tournamentStarted: room.tournamentStarted || false,
      };
      safeSend(
        hostSocket,
        {
          event: "GAME_ROOM",
          payload,
        },
        numericHostId,
      );
    },
  );

  fastify.decorate(
    "respondInvite",
    (response, roomId, hostId, inviteeId, username) => {
      // Ensure IDs are numbers for consistent lookup
      const normalizedRoomId = normalizeRemoteRoomId(roomId);
      const numericHostId = normalizeRemoteUserId(hostId, "Host ID");
      const numericInviteeId = normalizeRemoteUserId(inviteeId, "Invitee ID");
      const safeUsername = normalizeRemoteUsername(username, "Invitee username");
      const normalizedResponse = String(response ?? "").trim().toLowerCase();

      if (!["accepted", "rejected"].includes(normalizedResponse)) {
        throw new Error("Invite response is invalid");
      }

      const room = fastify.gameRooms.get(normalizedRoomId);
      if (!room) throw new Error("Room does not exist");

      if (!room.invitedPlayers.some((p) => Number(p.id) === numericInviteeId)) {
        throw new Error("Player not invited to this room");
      }

      if (resolveRoomMembership(numericInviteeId))
        throw new Error("Already in another game room");

      const hostSocket = fastify.onlineUsers.get(numericHostId);
      const inviteeSocket = fastify.onlineUsers.get(numericInviteeId);

      const buildPayload = () => ({
        roomId: normalizedRoomId,
        hostId: room.hostId,
        invitedPlayers: room.invitedPlayers,
        joinedPlayers: room.joinedPlayers,
        maxPlayers: room.maxPlayers,
        isTournament: room.isTournament || false,
        tournamentStarted: room.tournamentStarted || false,
      });

      const inviteResponsePayload = {
        roomId: normalizedRoomId,
        hostId: numericHostId,
        inviteeId: numericInviteeId,
        inviteeUsername: safeUsername,
        response: normalizedResponse,
      };

      if (normalizedResponse === "accepted") {
        // If room is full, remove extra "pending" players from
        // host's page and inform invitee that room is full.
        if (room.joinedPlayers.length === room.maxPlayers) {
          room.invitedPlayers = room.invitedPlayers.filter(
            (p) => Number(p.id) !== numericInviteeId,
          );
          safeSend(
            hostSocket,
            { event: "GAME_ROOM", payload: buildPayload() },
            numericHostId,
          );
          throw new Error("Room already full");
        }
        // Else, add new player
        fastify.currentRoom.set(numericInviteeId, normalizedRoomId);
        room.joinedPlayers.push({
          id: numericInviteeId,
          username: safeUsername,
        });
      }

      // Remove from invited players
      room.invitedPlayers = room.invitedPlayers.filter(
        (p) => Number(p.id) !== numericInviteeId,
      );

      const shouldCloseRoomAfterReject =
        normalizedResponse === "rejected" &&
        Number(room.hostId) === numericHostId &&
        room.joinedPlayers.length <= 1 &&
        room.invitedPlayers.length === 0;

      // Send update to invitee ONLY if accepted
      if (normalizedResponse === "accepted") {
        safeSend(
          inviteeSocket,
          {
            event: "JOIN_ROOM",
            payload: {
              roomId: normalizedRoomId,
              success: true,
              isTournament: Boolean(room.isTournament),
            },
          },
          numericInviteeId,
        );
        safeSend(
          inviteeSocket,
          { event: "GAME_ROOM", payload: buildPayload() },
          numericInviteeId,
        );
      }

      // Notify both sides of invite response for chat state updates
      safeSend(
        inviteeSocket,
        { event: "GAME_INVITE_RESPONSE", payload: inviteResponsePayload },
        numericInviteeId,
      );

      safeSend(
        hostSocket,
        { event: "GAME_INVITE_RESPONSE", payload: inviteResponsePayload },
        numericHostId,
      );

      if (shouldCloseRoomAfterReject) {
        fastify.leaveRoom(normalizedRoomId, numericHostId);
        return;
      }

      // Notify host to update game room
      safeSend(
        hostSocket,
        { event: "GAME_ROOM", payload: buildPayload() },
        numericHostId,
      );
    },
  );

  // Cancel a pending invite: remove invitee from room.invitedPlayers and notify them.
  // If this leaves the host alone with no one in invitedPlayers, destroy the room.
  fastify.decorate("cancelGameInvite", (roomId, hostId, inviteeId) => {
    const normalizedRoomId = normalizeRemoteRoomId(roomId);
    const numericHostId = normalizeRemoteUserId(hostId, "Host ID");
    const numericInviteeId = normalizeRemoteUserId(inviteeId, "Invitee ID");

    const room = fastify.gameRooms.get(normalizedRoomId);
    const hostSocket = fastify.onlineUsers.get(numericHostId);
    const inviteeSocket = fastify.onlineUsers.get(numericInviteeId);

    if (room) {
      room.invitedPlayers = room.invitedPlayers.filter(
        (p) => Number(p.id) !== numericInviteeId,
      );

      // Notify invitee that invite was cancelled
      safeSend(
        inviteeSocket,
        {
          event: "GAME_INVITE_CANCELLED",
          payload: { roomId: normalizedRoomId, hostId: numericHostId },
        },
        numericInviteeId,
      );

      // If room only has the host and no pending invites, destroy it
      if (room.joinedPlayers.length <= 1 && room.invitedPlayers.length === 0) {
        fastify.currentRoom.delete(numericHostId);
        fastify.gameRooms.delete(normalizedRoomId);
        safeSend(hostSocket, { event: "LEAVE_ROOM" }, numericHostId);
        return;
      }

      // Otherwise sync updated room state to host
      safeSend(
        hostSocket,
        {
          event: "GAME_ROOM",
          payload: {
            roomId: normalizedRoomId,
            hostId: room.hostId,
            invitedPlayers: room.invitedPlayers,
            joinedPlayers: room.joinedPlayers,
            maxPlayers: room.maxPlayers,
          },
        },
        numericHostId,
      );
    } else {
      // Room already gone — just notify invitee to clear invite UI
      safeSend(
        inviteeSocket,
        {
          event: "GAME_INVITE_CANCELLED",
          payload: { roomId: normalizedRoomId, hostId: numericHostId },
        },
        numericInviteeId,
      );
      fastify.currentRoom.delete(numericHostId);
    }
  });

  fastify.decorate("leaveRoom", (roomId, userId) => {
    const normalizedRoomId = normalizeRemoteRoomId(roomId);
    const numericUserId = normalizeRemoteUserId(userId);
    fastify.currentRoom.delete(numericUserId);
    const userSocket = fastify.onlineUsers.get(numericUserId);

    // Handle tournament player withdrawal if tournament has started
    // IMPORTANT: Do this before checking for room existence in gameRooms map
    // because if the server restarted, gameRooms will be empty but we might still have activeTournaments re-populated
    const tournamentId = `RT-${normalizedRoomId}`;
    if (fastify.activeTournaments) {
      const tournament = fastify.activeTournaments.get(tournamentId);
      if (tournament) {
//         console.log(
//           `[Tournament] User ${numericUserId} explicitly leaving tournament ${tournamentId}`,
//         );

        // Mark player as withdrawn - this will auto-resolve all their future matches
        const wasWithdrawn = tournament.markPlayerWithdrawn(numericUserId);

        if (wasWithdrawn) {
          const tournamentData = tournament.getSummary();

          // Broadcast the updated tournament state to everyone
          tournament.players.forEach((player) => {
            const socket = fastify.onlineUsers.get(Number(player.id));
            if (socket) {
              safeSend(
                socket,
                {
                  event: "TOURNAMENT_UPDATE",
                  payload: tournamentData,
                },
                Number(player.id),
              );
            }
          });

          // Specifically notify about the exit for UI feedback
          tournament.players.forEach((player) => {
            if (Number(player.id) !== numericUserId) {
              const socket = fastify.onlineUsers.get(Number(player.id));
              if (socket) {
                safeSend(
                  socket,
                  {
                    event: "TOURNAMENT_PLAYER_LEFT",
                    payload: {
                      playerId: numericUserId,
                      tournamentId: tournamentId,
                    },
                  },
                  Number(player.id),
                );
              }
            }
          });
        }
      }
    }

    const room = fastify.gameRooms.get(normalizedRoomId);
    if (!room) {
      safeSend(
        userSocket,
        {
          event: "LEAVE_ROOM",
        },
        numericUserId,
      );
      return; // Not throwing error as we always run leave room when user log outs
    }

    // Remove the user from joinedPlayers, invitedPlayers
    room.joinedPlayers = room.joinedPlayers.filter(
      (p) => Number(p.id) !== numericUserId,
    );
    room.invitedPlayers = room.invitedPlayers.filter(
      (p) => Number(p.id) !== numericUserId,
    );

    // If room is empty, delete it after a short grace period
    if (room.joinedPlayers.length === 0) {
      setTimeout(() => {
        const currentRoom = fastify.gameRooms.get(normalizedRoomId);
        if (currentRoom && currentRoom.joinedPlayers.length === 0) {
          fastify.gameRooms.delete(normalizedRoomId);
//           console.log(`[Room] Deleted empty room ${normalizedRoomId} after grace period`);
        }
      }, 5000); // 5 seconds grace period
    }

    // Broadcast update to remaining players in room
    room.joinedPlayers.forEach((player) => {
      const socket = fastify.onlineUsers.get(Number(player.id));
      if (socket) {
        safeSend(
          socket,
          {
            event: "GAME_ROOM",
            payload: {
              ...room,
              roomId: normalizedRoomId,
              joinedPlayers: room.joinedPlayers,
            },
          },
          Number(player.id),
        );
      }
    });

    // If the user who left is the host, transfer host ownership if
    // there are any other players who've joined. Else destroy the room.
    if (Number(room.hostId) === numericUserId) {
      if (room.joinedPlayers.length > 0) {
        room.hostId = Number(room.joinedPlayers[0].id);
        const newHostSocket = fastify.onlineUsers.get(room.hostId);
        // old host socket
        const oldHostSocket = fastify.onlineUsers.get(numericUserId);
        const payload = {
          roomId: normalizedRoomId,
          hostId: room.hostId,
          invitedPlayers: room.invitedPlayers,
          joinedPlayers: room.joinedPlayers,
          maxPlayers: room.maxPlayers,
          isTournament: room.isTournament || false,
          tournamentStarted: room.tournamentStarted || false,
        };
        safeSend(
          newHostSocket,
          {
            event: "GAME_ROOM",
            payload,
          },
          room.hostId,
        );
        safeSend(
          oldHostSocket,
          {
            event: "LEAVE_ROOM",
          },
          numericUserId,
        );
      } else {
        fastify.gameRooms.delete(normalizedRoomId);
        const oldHostSocket = fastify.onlineUsers.get(numericUserId);
        safeSend(
          oldHostSocket,
          {
            event: "LEAVE_ROOM",
          },
          numericUserId,
        );
      }
    } else {
      const hostSocket = fastify.onlineUsers.get(Number(room.hostId));
      const payload = {
        roomId: normalizedRoomId,
        hostId: room.hostId,
        invitedPlayers: room.invitedPlayers,
        joinedPlayers: room.joinedPlayers,
        maxPlayers: room.maxPlayers,
        isTournament: room.isTournament || false,
        tournamentStarted: room.tournamentStarted || false,
      };
      safeSend(
        hostSocket,
        {
          event: "GAME_ROOM",
          payload,
        },
        Number(room.hostId),
      );
      safeSend(
        userSocket,
        {
          event: "LEAVE_ROOM",
        },
        numericUserId,
      );
    }
  });

  fastify.decorate("joinRoomByCode", (roomIdInput, userId, username, mode) => {
    const roomId = normalizeRemoteRoomId(roomIdInput);
    const numericUserId = normalizeRemoteUserId(userId);
    const safeUsername = normalizeRemoteUsername(username);
    const safeMode = normalizeRemoteMatchmakingMode(mode);
//     console.log(`[JOIN_CODE_START] user: ${numericUserId}, code: [${roomId}]`);

    const room = fastify.gameRooms.get(roomId);
    if (!room) {
      console.error(`[JOIN_CODE_FAIL] Room not found: ${roomId}`);
      throw new Error("Room not found");
    }

    if (room.isPublic || room.isMatchmade) {
      throw new Error("Room code join is only available for private rooms");
    }

    const expectedTournamentRoom = safeMode === "tournament";
    if (Boolean(room.isTournament) !== expectedTournamentRoom) {
      throw new Error(
        expectedTournamentRoom
          ? "Tournament join can only join tournament rooms"
          : "Single join can only join single rooms",
      );
    }

    if (room.tournamentStarted) {
      throw new Error("Tournament already started");
    }

    normalizeRemotePlayerCount(
      room.maxPlayers,
      room.isTournament ? "tournament" : "single",
    );

    // Auto-leave ANY existing room logic
    const existingRoom = fastify.currentRoom.get(numericUserId);
    if (existingRoom && existingRoom !== roomId) {
//       console.log(
//         `[JOIN_CODE_MOVE] Player ${numericUserId} leaving room ${existingRoom} to join ${roomId}`,
//       );
      const staleRoom = fastify.gameRooms.get(existingRoom);
      if (staleRoom) {
        staleRoom.joinedPlayers = staleRoom.joinedPlayers.filter(
          (p) => Number(p.id) !== numericUserId,
        );
//         console.log(
//           `[JOIN_CODE_MOVE] Removed from stale. New count: ${staleRoom.joinedPlayers.length}`,
//         );
      }
      fastify.currentRoom.delete(numericUserId);
    }

    // Double-check membership (idempotency)
    const alreadyMember = room.joinedPlayers.some(
      (p) => Number(p.id) === numericUserId,
    );
    if (alreadyMember) {
//       console.log(
//         `[JOIN_CODE_EXISTING] Player ${numericUserId} already in room ${roomId}. Syncing.`,
//       );
      fastify.currentRoom.set(numericUserId, roomId); // Re-ensure map entry
      safeSend(
        fastify.onlineUsers.get(numericUserId),
        {
          event: "JOIN_ROOM",
          payload: {
            roomId,
            success: true,
            isTournament: Boolean(room.isTournament),
          },
        },
        numericUserId,
      );
      fastify.sendGameRoom(numericUserId);
      return;
    }

    if (room.joinedPlayers.length >= room.maxPlayers) {
      throw new Error("Room is full");
    }

    // Perform JOIN
    fastify.currentRoom.set(numericUserId, roomId);
    room.joinedPlayers.push({ id: numericUserId, username: safeUsername });
//     console.log(
//       `[JOIN_CODE_SUCCESS] User ${numericUserId} added to room ${roomId}. List: ${JSON.stringify(room.joinedPlayers)}`,
//     );

    // Notify ALL players in the room
    const joinPayload = {
      roomId,
      success: true,
      isTournament: Boolean(room.isTournament),
    };
    const roomSyncPayload = {
      event: "GAME_ROOM",
      payload: {
        roomId,
        hostId: room.hostId,
        invitedPlayers: room.invitedPlayers,
        joinedPlayers: room.joinedPlayers,
        maxPlayers: room.maxPlayers,
        isTournament: room.isTournament || false,
        tournamentStarted: room.tournamentStarted || false,
      },
    };

    room.joinedPlayers.forEach((p) => {
      const pid = Number(p.id);
      const s = fastify.onlineUsers.get(pid);
      if (pid === numericUserId) {
        safeSend(s, { event: "JOIN_ROOM", payload: joinPayload }, pid);
      }
      safeSend(s, roomSyncPayload, pid);
//       console.log(`[JOIN_CODE_NOTIFY] Sent sync to member ${pid}`);
    });
  });

  // Matchmaking queue
  const matchmakingQueue = {
    single: [], // { userId, username, socket, joinedAt }
    tournament: [],
  };

  fastify.decorate("joinMatchmaking", (userId, username, mode) => {
    const safeMode = normalizeRemoteMatchmakingMode(mode);
    const queue = matchmakingQueue[safeMode];
    const numericUserId = normalizeRemoteUserId(userId);
    const safeUsername = normalizeRemoteUsername(username);
    const socket = fastify.onlineUsers.get(numericUserId);

    // If a stale queue entry exists for this user, drop it and continue.
    // Single/tournament matchmaking now route primarily through room join/create flow.
    const existingQueueIndex = queue.findIndex(
      (p) => p.userId === numericUserId,
    );
    if (existingQueueIndex !== -1) {
//       console.log(
//         `[Matchmaking] Removing stale queue entry for user ${numericUserId} (mode=${safeMode})`,
//       );
      queue.splice(existingQueueIndex, 1);
    }

    // Check if already in a room
    const staleRoomId = fastify.currentRoom.get(numericUserId);
    if (staleRoomId) {
      const room = fastify.gameRooms.get(staleRoomId);
      const isAlreadyInThisRoom = room?.joinedPlayers?.some(
        (p) => Number(p.id) === numericUserId,
      );

      // Idempotency: if this user already joined a matchmade pre-game room,
      // ignore duplicate JOIN_MATCHMAKING calls instead of evicting them.
      if (
        room &&
        room.isMatchmade &&
        !room.tournamentStarted &&
        isAlreadyInThisRoom
      ) {
        const sameModeRoom =
          (safeMode === "single" && !room.isTournament) ||
          (safeMode === "tournament" && room.isTournament);
        if (sameModeRoom) {
//           console.log(
//             `[Matchmaking] Duplicate join rehydrated for user ${numericUserId} in room ${staleRoomId}`,
//           );

          // Re-send latest room snapshot so client can recover from stale UI state.
          safeSend(
            socket,
            {
              event: "GAME_ROOM",
              payload: {
                roomId: staleRoomId,
                hostId: room.hostId,
                invitedPlayers: room.invitedPlayers,
                joinedPlayers: room.joinedPlayers,
                maxPlayers: room.maxPlayers,
                isTournament: room.isTournament || false,
                tournamentStarted: room.tournamentStarted || false,
              },
            },
            numericUserId,
          );

          if (safeMode === "single") {
            // Host should return to the create lobby; joiners should go to join lobby.
            if (Number(room.hostId) === numericUserId) {
              safeSend(
                socket,
                {
                  event: "MATCHMAKING_HOST",
                  payload: { roomId: staleRoomId, recovered: true },
                },
                numericUserId,
              );
            } else {
              safeSend(
                socket,
                {
                  event: "MATCH_FOUND",
                  payload: {
                    roomId: staleRoomId,
                    matchId: `RS-${staleRoomId}`,
                    players: room.joinedPlayers,
                    hostId: room.hostId,
                    recovered: true,
                  },
                },
                numericUserId,
              );
            }
          } else {
            safeSend(
              socket,
              {
                event: "TOURNAMENT_FOUND",
                payload: {
                  roomId: staleRoomId,
                  tournamentId: `RT-${staleRoomId}`,
                  players: room.joinedPlayers,
                  isHost: Number(room.hostId) === numericUserId,
                  recovered: true,
                },
              },
              numericUserId,
            );
          }
          return;
        }

//         console.log(
//           `[Matchmaking] Duplicate join mode mismatch for user ${numericUserId} in room ${staleRoomId}, leaving stale room`,
//         );
      }

      if (room && !room.tournamentStarted) {
        // If user starts quick matchmaking while still bound to any pre-game room
        // (manual code room or previous matchmade lobby), auto-leave it.
//         console.log(
//           `[Matchmaking] Auto-leaving User ${numericUserId} from room ${staleRoomId} before queueing`,
//         );
        fastify.leaveRoom(staleRoomId, numericUserId);
      } else if (!room) {
        // Room mapping is stale (map points to a deleted room). Clear it and continue.
        fastify.currentRoom.delete(numericUserId);
      } else {
        throw new Error("Already in an active room");
      }
    }

    // For tournament mode: first try to find an existing available tournament room
    if (safeMode === "tournament") {
      // Find an available tournament room (not started, has space, is matchmade tournament)
      let availableRoom = null;
      let availableRoomId = null;

      for (const [roomId, room] of fastify.gameRooms.entries()) {
        // Check if it's a tournament room waiting for players
        // IMPORTANT: Only join rooms that haven't started yet
        if (
          room.isTournament &&
          room.isMatchmade &&
          room.isPublic &&
          !room.tournamentStarted &&
          room.joinedPlayers.length < room.maxPlayers
        ) {
          availableRoom = room;
          availableRoomId = roomId;
          break;
        }
      }

      if (availableRoom) {
        // Join the existing tournament room
        fastify.currentRoom.set(numericUserId, availableRoomId);
        availableRoom.joinedPlayers.push({
          id: numericUserId,
          username: safeUsername,
        });

//         console.log(
//           `[Matchmaking] User ${numericUserId} joined existing tournament room ${availableRoomId}`,
//         );

        // Send TOURNAMENT_FOUND to the new player
        safeSend(
          socket,
          {
            event: "TOURNAMENT_FOUND",
            payload: {
              roomId: availableRoomId,
              tournamentId: `RT-${availableRoomId}`,
              players: availableRoom.joinedPlayers,
            },
          },
          numericUserId,
        );

        // Notify all existing players about the new player
        const payload = {
          roomId: availableRoomId,
          hostId: availableRoom.hostId,
          invitedPlayers: availableRoom.invitedPlayers,
          joinedPlayers: availableRoom.joinedPlayers,
          maxPlayers: availableRoom.maxPlayers,
          isTournament: availableRoom.isTournament || false,
          tournamentStarted: availableRoom.tournamentStarted || false,
        };

        availableRoom.joinedPlayers.forEach((player) => {
          const playerSocket = fastify.onlineUsers.get(Number(player.id));
          safeSend(
            playerSocket,
            { event: "GAME_ROOM", payload },
            Number(player.id),
          );
        });

        return; // Don't add to queue since we joined a room
      }

      // No available room found, create a new one and become the host
      const roomId = crypto.randomUUID();
      fastify.currentRoom.set(numericUserId, roomId);

      fastify.gameRooms.set(roomId, {
        hostId: numericUserId,
        invitedPlayers: [],
        joinedPlayers: [{ id: numericUserId, username: safeUsername }],
        maxPlayers: REMOTE_TOURNAMENT_MAX_PLAYERS,
        isMatchmade: true,
        isPublic: true,
        isTournament: true,
        tournamentStarted: false,
      });

//       console.log(
//         `[Matchmaking] User ${numericUserId} created new tournament room ${roomId}`,
//       );

      // Send TOURNAMENT_FOUND to the host
      safeSend(
        socket,
        {
          event: "TOURNAMENT_FOUND",
          payload: {
            roomId,
            tournamentId: `RT-${roomId}`,
            players: [{ id: numericUserId, username: safeUsername }],
            isHost: true,
          },
        },
        numericUserId,
      );

      return; // Don't add to queue since we created a room
    }

    // For single mode: Search for available room, or create one
    if (safeMode === "single") {
      // Search for an available matchmade room (host waiting)
      let availableRoom = null;
      let availableRoomId = null;

//       console.log(`[Matchmaking] Searching for 1v1 room. Total rooms: ${fastify.gameRooms.size}`);
      for (const [roomId, room] of fastify.gameRooms.entries()) {
//         console.log(
//           `[Matchmaking] Checking room ${roomId}: isTournament=${room.isTournament}, isMatchmade=${room.isMatchmade}, isPublic=${room.isPublic}, maxPlayers=${room.maxPlayers}, joined=${room.joinedPlayers.length}`,
//         );

        if (
          !room.isTournament &&
          room.isMatchmade &&
          room.isPublic &&
          Number(room.maxPlayers) === REMOTE_SINGLE_PLAYER_COUNT &&
          !hasOnlineJoinedPlayer(room)
        ) {
//           console.log(`[Matchmaking] Removing orphaned public 1v1 room: ${roomId}`);
          removeRoomMembershipMappings(roomId, room);
          fastify.gameRooms.delete(roomId);
          continue;
        }

        if (
          !room.isTournament &&
          room.isMatchmade &&
          room.isPublic &&
          Number(room.maxPlayers) === REMOTE_SINGLE_PLAYER_COUNT &&
          room.joinedPlayers.length < room.maxPlayers
        ) {
          if (room.joinedPlayers.some((p) => Number(p.id) === numericUserId)) {
            fastify.currentRoom.set(numericUserId, roomId);
            continue;
          }
          availableRoom = room;
          availableRoomId = roomId;
//           console.log(`[Matchmaking] Found available public 1v1 room: ${roomId}`);
          break;
        }
      }

      if (availableRoom) {
        // Join the existing room
        fastify.currentRoom.set(numericUserId, availableRoomId);
        availableRoom.joinedPlayers.push({
          id: numericUserId,
          username: safeUsername,
        });
        availableRoom.isMatchmade = true; // Mark as matchmade room for grace period logic

//         console.log(
//           `[Matchmaking] User ${numericUserId} matched into room ${availableRoomId}`,
//         );

        const roomSyncPayload = {
          event: "GAME_ROOM",
          payload: {
            roomId: availableRoomId,
            hostId: availableRoom.hostId,
            invitedPlayers: availableRoom.invitedPlayers,
            joinedPlayers: availableRoom.joinedPlayers,
            maxPlayers: availableRoom.maxPlayers,
            isTournament: availableRoom.isTournament || false,
            tournamentStarted: availableRoom.tournamentStarted || false,
          },
        };

        // Notify BOTH players that a match was found
        // They should be redirected to the lobby, NOT auto-start the game
        const payload = {
          event: "MATCH_FOUND",
          payload: {
            roomId: availableRoomId,
            matchId: `RS-${availableRoomId}`,
            players: availableRoom.joinedPlayers,
            hostId: availableRoom.hostId,
          },
        };

        availableRoom.joinedPlayers.forEach((p) => {
          const s = fastify.onlineUsers.get(Number(p.id));
          if (!s) return;
          safeSend(s, roomSyncPayload, Number(p.id));
          safeSend(s, payload, Number(p.id));
        });
        return;
      }

      // No room found, create one and be the host
      const roomId = crypto.randomUUID();
      fastify.currentRoom.set(numericUserId, roomId);

      fastify.gameRooms.set(roomId, {
        hostId: numericUserId,
        invitedPlayers: [],
        joinedPlayers: [{ id: numericUserId, username: safeUsername }],
        maxPlayers: REMOTE_SINGLE_PLAYER_COUNT,
        isMatchmade: true,
        isPublic: true,
        isTournament: false,
      });

//       console.log(
//         `[Matchmaking] User ${numericUserId} created single room ${roomId}`,
//       );

      // Send GAME_ROOM so their context updates
      const roomPayload = {
        roomId: roomId,
        hostId: numericUserId,
        invitedPlayers: [],
        joinedPlayers: [{ id: numericUserId, username: safeUsername }],
        maxPlayers: REMOTE_SINGLE_PLAYER_COUNT,
      };

      safeSend(
        socket,
        {
          event: "GAME_ROOM",
          payload: roomPayload,
        },
        numericUserId,
      );

      // Tell them they are the host so they redirect to lobby
      safeSend(
        socket,
        {
          event: "MATCHMAKING_HOST",
          payload: { roomId },
        },
        numericUserId,
      );

      return;
    }

    // For tournament mode (queue fallback if needed, though joinMatchmaking handles it above):
    queue.push({
      userId: numericUserId,
      username: safeUsername,
      socket,
      joinedAt: Date.now(),
    });

    // Send confirmation
    safeSend(
      socket,
      {
        event: "MATCHMAKING_JOINED",
        payload: { mode: safeMode, position: queue.length },
      },
      numericUserId,
    );

    // Try to match players
    fastify.tryMatchPlayers(safeMode);
  });

  fastify.decorate("leaveMatchmaking", (userId, immediate = true) => {
    const numericUserId = normalizeRemoteUserId(userId);
//     console.log(`[leaveMatchmaking] user: ${numericUserId}, immediate: ${immediate}`);

    // Remove from both queues
    matchmakingQueue.single = matchmakingQueue.single.filter(
      (p) => p.userId !== numericUserId,
    );
    matchmakingQueue.tournament = matchmakingQueue.tournament.filter(
      (p) => p.userId !== numericUserId,
    );

    if (!immediate) {
//       console.log(`[leaveMatchmaking] Skipping room removal for ${numericUserId} (delegating to grace period)`);
      return;
    }

    const currentRoomId = fastify.currentRoom.get(numericUserId);
    if (currentRoomId) {
      fastify.leaveRoom(currentRoomId, userId);
    }

    const socket = fastify.onlineUsers.get(numericUserId);
    if (socket) {
      safeSend(socket, { event: "MATCHMAKING_LEFT" }, numericUserId);
    }
  });

  fastify.decorate("tryMatchPlayers", (mode) => {
    const safeMode = normalizeRemoteMatchmakingMode(mode);
    const queue = matchmakingQueue[safeMode];

    if (safeMode === "single" && queue.length >= REMOTE_SINGLE_PLAYER_COUNT) {
      // Match two players for single match
      const player1 = queue.shift();
      const player2 = queue.shift();

      // Create a room for them
      const roomId = crypto.randomUUID();
      fastify.currentRoom.set(player1.userId, roomId);
      fastify.currentRoom.set(player2.userId, roomId);

      fastify.gameRooms.set(roomId, {
        hostId: player1.userId,
        invitedPlayers: [],
        joinedPlayers: [
          { id: player1.userId, username: player1.username },
          { id: player2.userId, username: player2.username },
        ],
        maxPlayers: REMOTE_SINGLE_PLAYER_COUNT,
        isMatchmade: true,
        isPublic: true,
        isTournament: false,
        tournamentStarted: false,
      });

      const payload = {
        event: "MATCH_FOUND",
        payload: {
          roomId,
          matchId: `RS-${roomId}`,
          hostId: player1.userId,
          players: [
            { id: player1.userId, username: player1.username },
            { id: player2.userId, username: player2.username },
          ],
        },
      };

      safeSend(player1.socket, payload, player1.userId);
      safeSend(player2.socket, payload, player2.userId);
    } else if (
      safeMode === "tournament" &&
      queue.length >= REMOTE_TOURNAMENT_MIN_PLAYERS
    ) {
      // Match players for tournament (3-8 players, start with 4 for now)
      const minPlayers = REMOTE_TOURNAMENT_MIN_PLAYERS;
      const maxPlayers = Math.min(queue.length, REMOTE_TOURNAMENT_MAX_PLAYERS);

      if (queue.length >= minPlayers) {
        const players = queue.splice(0, maxPlayers);

        const roomId = crypto.randomUUID();
        players.forEach((p) => fastify.currentRoom.set(p.userId, roomId));

        fastify.gameRooms.set(roomId, {
          hostId: players[0].userId,
          invitedPlayers: [],
          joinedPlayers: players.map((p) => ({
            id: p.userId,
            username: p.username,
          })),
          maxPlayers: REMOTE_TOURNAMENT_MAX_PLAYERS,
          isMatchmade: true,
          isPublic: true,
          isTournament: true,
          tournamentStarted: false,
        });

        const payload = {
          event: "TOURNAMENT_FOUND",
          payload: {
            roomId,
            tournamentId: `RT-${roomId}`,
            players: players.map((p) => ({
              id: p.userId,
              username: p.username,
            })),
          },
        };

        players.forEach((p) => safeSend(p.socket, payload, p.userId));
      }
    }
  });

  /**
   * Creates the bracket before clients navigate so every participant can load it
   * immediately, even if the host page is slow or refreshes mid-transition.
   */
  const ensureRemoteTournament = (tournamentId, room) => {
    const tournamentStore = fastify.activeTournaments || activeTournaments;

    if (tournamentStore.has(tournamentId)) {
      return tournamentStore.get(tournamentId);
    }

    const players = normalizeRemoteTournamentPlayers(room);
    const tournament = new TournamentManager(tournamentId, players);

    if (tournament.format === "round-robin") {
      tournament.matches = tournament.generateRoundRobinPairings();
    } else if (tournament.format === "swiss") {
      tournament.matches = tournament.generateSwissPairings(1);
    }

    tournamentStore.set(tournamentId, tournament);
    return tournament;
  };

  /**
   * Start a tournament for all players in the room
   * Notifies all players to navigate to the tournament game page
   */
  fastify.decorate("startTournament", (roomId, tournamentId, actingUserId) => {
    const normalizedRoomId = normalizeRemoteRoomId(roomId);
    const normalizedTournamentId = normalizeRemoteTournamentId(
      tournamentId,
      normalizedRoomId,
    );
    const numericActorId = normalizeRemoteUserId(actingUserId, "Acting user ID");

//     console.log(`[Tournament] START_TOURNAMENT received: roomId=${normalizedRoomId}, tournamentId=${normalizedTournamentId}`);
    const room = fastify.gameRooms.get(normalizedRoomId);
    if (!room) {
      console.error(`[Tournament] Room NOT FOUND: ${normalizedRoomId}`);
//       console.log(`[Tournament] Available rooms: ${[...fastify.gameRooms.keys()].join(", ")}`);
      throw new Error("Room not found");
    }

    if (Number(room.hostId) !== numericActorId) {
      console.warn(
        `[Tournament] START_TOURNAMENT rejected: user ${numericActorId} is not host (host=${room.hostId})`,
      );
      throw new Error("Only the room host can start the tournament");
    }
    
//     console.log(`[Tournament] Room ${normalizedRoomId} found. Players: ${room.joinedPlayers.length}. tournamentStarted=${room.tournamentStarted}`);
    
    assertRemoteRoomCanStartTournament(room);
    ensureRemoteTournament(normalizedTournamentId, room);

    // Mark tournament as started so new players can't join via matchmaking
    room.tournamentStarted = true;

    const payload = {
      event: "TOURNAMENT_START",
      payload: {
        roomId: normalizedRoomId,
        tournamentId: normalizedTournamentId,
        players: room.joinedPlayers,
      },
    };

    // Notify all players in the room (using numeric ID for lookup)
    room.joinedPlayers.forEach((player) => {
      const socket = fastify.onlineUsers.get(Number(player.id));
      safeSend(socket, payload, Number(player.id));
    });

//     console.log(
//       `Tournament ${normalizedTournamentId} started with ${room.joinedPlayers.length} players`,
//     );
  });
});
