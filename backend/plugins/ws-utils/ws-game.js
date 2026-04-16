import { PrismaClient } from "../../generated/prisma/index.js";
import fp from "fastify-plugin";
import crypto from "crypto";
import { safeSend } from "../../utils/ws-utils.js";

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

  fastify.decorate(
    "createGameRoom",
    (hostId, hostUsername, maxPlayers, isPublic = false, isTournament = false) => {
      console.log(`[CREATE_ROOM_START] hostId: ${hostId} (${hostUsername})`);
      const roomId = crypto.randomUUID();
      const numericHostId = Number(hostId);

      fastify.currentRoom.set(numericHostId, roomId);
      console.log(
        `[CREATE_ROOM_MAP] currentRoom.set(${numericHostId}, ${roomId})`,
      );

      const roomState = {
        hostId: numericHostId,
        invitedPlayers: [],
        joinedPlayers: [{ id: numericHostId, username: hostUsername }],
        maxPlayers,
        isPublic,
        isTournament,
        tournamentStarted: false,
        createdAt: Date.now(),
      };
      fastify.gameRooms.set(roomId, roomState);
      console.log(
        `[CREATE_ROOM_MAP] gameRooms.set(${roomId}, ${JSON.stringify(roomState)})`,
      );

      return roomId;
    },
  );

  fastify.decorate("sendGameRoom", (userId) => {
    const numericUserId = Number(userId);
    console.log(`[SEND_ROOM_START] userId: ${numericUserId}`);

    let roomId = fastify.currentRoom.get(numericUserId);
    console.log(
      `[SEND_ROOM_GET] currentRoom.get(${numericUserId}) -> ${roomId}`,
    );

    if (!roomId) {
      console.log(
        `[SEND_ROOM_FALLBACK] Searching all rooms for player ${numericUserId}...`,
      );
      for (const [id, room] of fastify.gameRooms.entries()) {
        const isJoined = room.joinedPlayers.some(
          (p) => Number(p.id) === numericUserId,
        );
        if (isJoined) {
          roomId = id;
          fastify.currentRoom.set(numericUserId, roomId);
          console.log(
            `[SEND_ROOM_RECOVERED] Found in room ${roomId}. Fixed map.`,
          );
          break;
        }
      }
    }

    if (!roomId) {
      console.log(
        `[SEND_ROOM_NOT_FOUND] User ${numericUserId} has no active room.`,
      );
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

    console.log(
      `[SEND_ROOM_PAYLOAD] Sending to ${numericUserId}: ${JSON.stringify(payload)}`,
    );
    const sockets = fastify.onlineUsers.get(numericUserId);
    safeSend(sockets, { event: "GAME_ROOM", payload }, numericUserId);
  });

  fastify.decorate(
    "sendGameInvite",
    (roomId, hostId, hostUsername, friendId, friendUsername) => {
      // Ensure IDs are numbers for consistent lookup
      const numericFriendId = Number(friendId);
      const numericHostId = Number(hostId);

      const inviteeInRoom = resolveRoomMembership(numericFriendId);
      if (inviteeInRoom) throw new Error("Player already in another room");

      // Reject invite if friend is not online (no open WS connection)
      const inviteeSocket = fastify.onlineUsers.get(numericFriendId);
      if (!inviteeSocket || inviteeSocket.size === 0) {
        // Clean up the room that was just created for this invite
        fastify.currentRoom.delete(numericHostId);
        fastify.gameRooms.delete(roomId);
        throw new Error("Friend is not online");
      }

      const room = fastify.gameRooms.get(roomId);
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
              friendUsername,
              roomId,
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
              friendUsername,
              roomId,
              reason: "already-pending",
            },
          },
          numericHostId,
        );
        return;
      }

      room.invitedPlayers.push({
        id: numericFriendId,
        username: friendUsername,
      });

      // Send game invite to invitee (socket already fetched above for online check)
      safeSend(
        inviteeSocket,
        {
          event: "GAME_INVITE",
          payload: { roomId, hostId: numericHostId, hostUsername },
        },
        numericFriendId,
      );

      // Persist invite in chat history so it survives page reloads.
      prisma.message
        .create({
          data: {
            senderId: numericHostId,
            recipientId: numericFriendId,
            content: `${hostUsername} invited you to join private room ${roomId}`,
          },
        })
        .catch((err) => {
          console.error("Failed to persist room invite message:", err);
        });

      // Send updated game room to host
      const payload = {
        hostId: room.hostId,
        invitedPlayers: room.invitedPlayers,
        joinedPlayers: room.joinedPlayers,
        maxPlayers: room.maxPlayers,
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
      const room = fastify.gameRooms.get(roomId);
      if (!room) throw new Error("Room does not exist");

      // Ensure IDs are numbers for consistent lookup
      const numericHostId = Number(hostId);
      const numericInviteeId = Number(inviteeId);

      if (!room.invitedPlayers.some((p) => Number(p.id) === numericInviteeId)) {
        throw new Error("Player not invited to this room");
      }

      if (resolveRoomMembership(numericInviteeId))
        throw new Error("Already in another game room");

      const hostSocket = fastify.onlineUsers.get(numericHostId);
      const inviteeSocket = fastify.onlineUsers.get(numericInviteeId);

      const buildPayload = () => ({
        hostId: room.hostId,
        invitedPlayers: room.invitedPlayers,
        joinedPlayers: room.joinedPlayers,
        maxPlayers: room.maxPlayers,
      });

      const inviteResponsePayload = {
        roomId,
        hostId: numericHostId,
        inviteeId: numericInviteeId,
        inviteeUsername: username,
        response,
      };

      if (response === "accepted") {
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
        fastify.currentRoom.set(numericInviteeId, roomId);
        room.joinedPlayers.push({ id: numericInviteeId, username: username });
      }

      // Remove from invited players
      room.invitedPlayers = room.invitedPlayers.filter(
        (p) => Number(p.id) !== numericInviteeId,
      );

      const shouldCloseRoomAfterReject =
        response === "rejected" &&
        Number(room.hostId) === numericHostId &&
        room.joinedPlayers.length <= 1 &&
        room.invitedPlayers.length === 0;

      // Send update to invitee ONLY if accepted
      if (response === "accepted") {
        safeSend(
          inviteeSocket,
          { event: "JOIN_ROOM", payload: { roomId } },
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
        fastify.leaveRoom(roomId, numericHostId);
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
    const numericHostId = Number(hostId);
    const numericInviteeId = Number(inviteeId);

    const room = fastify.gameRooms.get(roomId);
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
          payload: { roomId, hostId: numericHostId },
        },
        numericInviteeId,
      );

      // If room only has the host and no pending invites, destroy it
      if (room.joinedPlayers.length <= 1 && room.invitedPlayers.length === 0) {
        fastify.currentRoom.delete(numericHostId);
        fastify.gameRooms.delete(roomId);
        safeSend(hostSocket, { event: "LEAVE_ROOM" }, numericHostId);
        return;
      }

      // Otherwise sync updated room state to host
      safeSend(
        hostSocket,
        {
          event: "GAME_ROOM",
          payload: {
            roomId,
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
          payload: { roomId, hostId: numericHostId },
        },
        numericInviteeId,
      );
      fastify.currentRoom.delete(numericHostId);
    }
  });

  fastify.decorate("leaveRoom", (roomId, userId) => {
    const numericUserId = Number(userId);
    fastify.currentRoom.delete(numericUserId);
    const userSocket = fastify.onlineUsers.get(numericUserId);

    // Handle tournament player withdrawal if tournament has started
    // IMPORTANT: Do this before checking for room existence in gameRooms map
    // because if the server restarted, gameRooms will be empty but we might still have activeTournaments re-populated
    const tournamentId = `RT-${roomId}`;
    if (fastify.activeTournaments) {
      const tournament = fastify.activeTournaments.get(tournamentId);
      if (tournament) {
        console.log(
          `[Tournament] User ${numericUserId} explicitly leaving tournament ${tournamentId}`,
        );

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

    const room = fastify.gameRooms.get(roomId);
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
        const currentRoom = fastify.gameRooms.get(roomId);
        if (currentRoom && currentRoom.joinedPlayers.length === 0) {
          fastify.gameRooms.delete(roomId);
          console.log(`[Room] Deleted empty room ${roomId} after grace period`);
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
        fastify.gameRooms.delete(roomId);
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
        roomId: roomId,
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

  fastify.decorate("joinRoomByCode", (roomIdInput, userId, username) => {
    const roomId = roomIdInput.trim();
    const numericUserId = Number(userId);
    console.log(`[JOIN_CODE_START] user: ${numericUserId}, code: [${roomId}]`);

    const room = fastify.gameRooms.get(roomId);
    if (!room) {
      console.error(`[JOIN_CODE_FAIL] Room not found: ${roomId}`);
      throw new Error("Room not found");
    }

    // Auto-leave ANY existing room logic
    const existingRoom = fastify.currentRoom.get(numericUserId);
    if (existingRoom && existingRoom !== roomId) {
      console.log(
        `[JOIN_CODE_MOVE] Player ${numericUserId} leaving room ${existingRoom} to join ${roomId}`,
      );
      const staleRoom = fastify.gameRooms.get(existingRoom);
      if (staleRoom) {
        staleRoom.joinedPlayers = staleRoom.joinedPlayers.filter(
          (p) => Number(p.id) !== numericUserId,
        );
        console.log(
          `[JOIN_CODE_MOVE] Removed from stale. New count: ${staleRoom.joinedPlayers.length}`,
        );
      }
      fastify.currentRoom.delete(numericUserId);
    }

    // Double-check membership (idempotency)
    const alreadyMember = room.joinedPlayers.some(
      (p) => Number(p.id) === numericUserId,
    );
    if (alreadyMember) {
      console.log(
        `[JOIN_CODE_EXISTING] Player ${numericUserId} already in room ${roomId}. Syncing.`,
      );
      fastify.currentRoom.set(numericUserId, roomId); // Re-ensure map entry
      safeSend(
        fastify.onlineUsers.get(numericUserId),
        { event: "JOIN_ROOM", payload: { roomId, success: true } },
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
    room.joinedPlayers.push({ id: numericUserId, username });
    console.log(
      `[JOIN_CODE_SUCCESS] User ${numericUserId} added to room ${roomId}. List: ${JSON.stringify(room.joinedPlayers)}`,
    );

    // Notify ALL players in the room
    const joinPayload = { roomId, success: true };
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
      console.log(`[JOIN_CODE_NOTIFY] Sent sync to member ${pid}`);
    });
  });

  // Matchmaking queue
  const matchmakingQueue = {
    single: [], // { userId, username, socket, joinedAt }
    tournament: [],
  };

  fastify.decorate("joinMatchmaking", (userId, username, mode) => {
    const queue = matchmakingQueue[mode];
    if (!queue) throw new Error("Invalid matchmaking mode");

    // Ensure userId is a number for consistent lookup
    const numericUserId = Number(userId);
    const socket = fastify.onlineUsers.get(numericUserId);

    // If a stale queue entry exists for this user, drop it and continue.
    // Single/tournament matchmaking now route primarily through room join/create flow.
    const existingQueueIndex = queue.findIndex(
      (p) => p.userId === numericUserId,
    );
    if (existingQueueIndex !== -1) {
      console.log(
        `[Matchmaking] Removing stale queue entry for user ${numericUserId} (mode=${mode})`,
      );
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
          (mode === "single" && !room.isTournament) ||
          (mode === "tournament" && room.isTournament);
        if (sameModeRoom) {
          console.log(
            `[Matchmaking] Duplicate join rehydrated for user ${numericUserId} in room ${staleRoomId}`,
          );

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

          if (mode === "single") {
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

        console.log(
          `[Matchmaking] Duplicate join mode mismatch for user ${numericUserId} in room ${staleRoomId}, leaving stale room`,
        );
      }

      if (room && !room.tournamentStarted) {
        // If user starts quick matchmaking while still bound to any pre-game room
        // (manual code room or previous matchmade lobby), auto-leave it.
        console.log(
          `[Matchmaking] Auto-leaving User ${numericUserId} from room ${staleRoomId} before queueing`,
        );
        fastify.leaveRoom(staleRoomId, numericUserId);
      } else if (!room) {
        // Room mapping is stale (map points to a deleted room). Clear it and continue.
        fastify.currentRoom.delete(numericUserId);
      } else {
        throw new Error("Already in an active room");
      }
    }

    // For tournament mode: first try to find an existing available tournament room
    if (mode === "tournament") {
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
        availableRoom.joinedPlayers.push({ id: numericUserId, username });

        console.log(
          `[Matchmaking] User ${numericUserId} joined existing tournament room ${availableRoomId}`,
        );

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
        joinedPlayers: [{ id: numericUserId, username }],
        maxPlayers: 8,
        isMatchmade: true,
        isPublic: true,
        isTournament: true,
        tournamentStarted: false,
      });

      console.log(
        `[Matchmaking] User ${numericUserId} created new tournament room ${roomId}`,
      );

      // Send TOURNAMENT_FOUND to the host
      safeSend(
        socket,
        {
          event: "TOURNAMENT_FOUND",
          payload: {
            roomId,
            tournamentId: `RT-${roomId}`,
            players: [{ id: numericUserId, username }],
            isHost: true,
          },
        },
        numericUserId,
      );

      return; // Don't add to queue since we created a room
    }

    // For single mode: Search for available room, or create one
    if (mode === "single") {
      // Search for an available matchmade room (host waiting)
      let availableRoom = null;
      let availableRoomId = null;

      console.log(`[Matchmaking] Searching for 1v1 room. Total rooms: ${fastify.gameRooms.size}`);
      for (const [roomId, room] of fastify.gameRooms.entries()) {
        console.log(
          `[Matchmaking] Checking room ${roomId}: isTournament=${room.isTournament}, isMatchmade=${room.isMatchmade}, isPublic=${room.isPublic}, maxPlayers=${room.maxPlayers}, joined=${room.joinedPlayers.length}`,
        );
        if (
          !room.isTournament &&
          room.isPublic &&
          room.joinedPlayers.length < room.maxPlayers
        ) {
          availableRoom = room;
          availableRoomId = roomId;
          console.log(`[Matchmaking] Found available public 1v1 room: ${roomId}`);
          break;
        }
      }

      if (availableRoom) {
        // Join the existing room
        fastify.currentRoom.set(numericUserId, availableRoomId);
        availableRoom.joinedPlayers.push({ id: numericUserId, username });
        availableRoom.isMatchmade = true; // Mark as matchmade room for grace period logic

        console.log(
          `[Matchmaking] User ${numericUserId} matched into room ${availableRoomId}`,
        );

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
        joinedPlayers: [{ id: numericUserId, username }],
        maxPlayers: 2,
        isMatchmade: true,
        isPublic: true,
        isTournament: false,
      });

      console.log(
        `[Matchmaking] User ${numericUserId} created single room ${roomId}`,
      );

      // Send GAME_ROOM so their context updates
      const roomPayload = {
        roomId: roomId,
        hostId: numericUserId,
        invitedPlayers: [],
        joinedPlayers: [{ id: numericUserId, username }],
        maxPlayers: 2,
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
      username,
      socket,
      joinedAt: Date.now(),
    });

    // Send confirmation
    safeSend(
      socket,
      {
        event: "MATCHMAKING_JOINED",
        payload: { mode, position: queue.length },
      },
      numericUserId,
    );

    // Try to match players
    fastify.tryMatchPlayers(mode);
  });

  fastify.decorate("leaveMatchmaking", (userId, immediate = true) => {
    const numericUserId = Number(userId);
    console.log(`[leaveMatchmaking] user: ${numericUserId}, immediate: ${immediate}`);

    // Remove from both queues
    matchmakingQueue.single = matchmakingQueue.single.filter(
      (p) => p.userId !== numericUserId,
    );
    matchmakingQueue.tournament = matchmakingQueue.tournament.filter(
      (p) => p.userId !== numericUserId,
    );

    if (!immediate) {
      console.log(`[leaveMatchmaking] Skipping room removal for ${numericUserId} (delegating to grace period)`);
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
    const queue = matchmakingQueue[mode];

    if (mode === "single" && queue.length >= 2) {
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
        maxPlayers: 2,
        isMatchmade: true,
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
    } else if (mode === "tournament" && queue.length >= 3) {
      // Match players for tournament (3-8 players, start with 4 for now)
      const minPlayers = 3;
      const maxPlayers = Math.min(queue.length, 8);

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
          maxPlayers: 8,
          isMatchmade: true,
          isTournament: true,
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
   * Start a tournament for all players in the room
   * Notifies all players to navigate to the tournament game page
   */
  fastify.decorate("startTournament", (roomId, tournamentId) => {
    console.log(`[Tournament] START_TOURNAMENT received: roomId=${roomId}, tournamentId=${tournamentId}`);
    const room = fastify.gameRooms.get(roomId);
    if (!room) {
      console.error(`[Tournament] Room NOT FOUND: ${roomId}`);
      console.log(`[Tournament] Available rooms: ${[...fastify.gameRooms.keys()].join(", ")}`);
      throw new Error("Room not found");
    }
    
    console.log(`[Tournament] Room ${roomId} found. Players: ${room.joinedPlayers.length}. tournamentStarted=${room.tournamentStarted}`);
    
    if (room.joinedPlayers.length < 3) {
      console.warn(`[Tournament] Not enough players: ${room.joinedPlayers.length}`);
      throw new Error("Need at least 3 players for a tournament");
    }

    // Mark tournament as started so new players can't join via matchmaking
    room.tournamentStarted = true;

    const payload = {
      event: "TOURNAMENT_START",
      payload: {
        roomId,
        tournamentId,
        players: room.joinedPlayers,
      },
    };

    // Notify all players in the room (using numeric ID for lookup)
    room.joinedPlayers.forEach((player) => {
      const socket = fastify.onlineUsers.get(Number(player.id));
      safeSend(socket, payload, Number(player.id));
    });

    console.log(
      `Tournament ${tournamentId} started with ${room.joinedPlayers.length} players`,
    );
  });
});
