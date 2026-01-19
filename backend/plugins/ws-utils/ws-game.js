import { PrismaClient } from "/app/generated/prisma/index.js";
import fp from "fastify-plugin";
import crypto from "crypto";
import { safeSend } from "../../utils/ws-utils.js";

const prisma = new PrismaClient();

export default fp((fastify) => {
  fastify.decorate("createGameRoom", (hostId, hostUsername, maxPlayers) => {
    const roomId = crypto.randomUUID();
    // Ensure hostId is a number for consistent lookup in onlineUsers
    const numericHostId = Number(hostId);
    fastify.currentRoom.set(numericHostId, roomId);

    fastify.gameRooms.set(roomId, {
      hostId: numericHostId,
      invitedPlayers: [],
      joinedPlayers: [{ id: numericHostId, username: hostUsername }],
      maxPlayers,
    });
    return roomId;
  });

  fastify.decorate("sendGameRoom", (userId) => {
    // Ensure userId is a number for consistent lookup
    const numericUserId = Number(userId);

    let roomId = fastify.currentRoom.get(numericUserId);

    // Fallback: If not in currentRoom, check if user is in any active game room
    // This handles cases where socket disconnected but user is still logically in the room
    if (!roomId) {
      for (const [id, room] of fastify.gameRooms.entries()) {
        const isJoined = room.joinedPlayers.some(p => Number(p.id) === numericUserId);
        if (isJoined) {
          roomId = id;
          fastify.currentRoom.set(numericUserId, roomId);
          console.log(`[sendGameRoom] Recovered room ${roomId} for user ${numericUserId}`);
          break;
        }
      }
    }

    if (!roomId) return;
    const room = fastify.gameRooms.get(roomId);
    if (!room) {
      const socket = fastify.onlineUsers.get(numericUserId);
      safeSend(socket, { event: "ROOM_NOT_FOUND" }, numericUserId);
      return;
    }

    const isHost = numericUserId === Number(room.hostId);
    const isJoined = room.joinedPlayers.some((p) => Number(p.id) === numericUserId);

    if (!isHost && !isJoined) {
      throw new Error(`You are not part of this room`);
    }

    const payload = {
      roomId: roomId,
      hostId: room.hostId,
      invitedPlayers: room.invitedPlayers,
      joinedPlayers: room.joinedPlayers,
      maxPlayers: room.maxPlayers,
    };

    const socket = fastify.onlineUsers.get(numericUserId);
    safeSend(
      socket,
      {
        event: "GAME_ROOM",
        payload,
      },
      numericUserId
    );
  });

  fastify.decorate(
    "sendGameInvite",
    (roomId, hostId, hostUsername, friendId, friendUsername) => {
      // Ensure IDs are numbers for consistent lookup
      const numericFriendId = Number(friendId);
      const numericHostId = Number(hostId);

      const inviteeInRoom = fastify.currentRoom.get(numericFriendId);
      if (inviteeInRoom) throw new Error("Player already in another room");

      const room = fastify.gameRooms.get(roomId);
      room.invitedPlayers.push({ id: numericFriendId, username: friendUsername });

      // Send game invite to invitee
      const inviteeSocket = fastify.onlineUsers.get(numericFriendId);
      safeSend(
        inviteeSocket,
        {
          event: "GAME_INVITE",
          payload: { roomId, hostId: numericHostId, hostUsername },
        },
        numericFriendId
      );

      // Send updated game room to host
      const hostSocket = fastify.onlineUsers.get(numericHostId);
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
        numericHostId
      );
    }
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

      if (fastify.currentRoom.get(numericInviteeId))
        throw new Error("Already in another game room");

      const hostSocket = fastify.onlineUsers.get(numericHostId);
      const inviteeSocket = fastify.onlineUsers.get(numericInviteeId);

      const buildPayload = () => ({
        hostId: room.hostId,
        invitedPlayers: room.invitedPlayers,
        joinedPlayers: room.joinedPlayers,
        maxPlayers: room.maxPlayers,
      });

      if (response === "accepted") {
        // If room is full, remove extra "pending" players from
        // host's page and inform invitee that room is full.
        if (room.joinedPlayers.length === room.maxPlayers) {
          room.invitedPlayers = room.invitedPlayers.filter(
            (p) => Number(p.id) !== numericInviteeId
          );
          safeSend(
            hostSocket,
            { event: "GAME_ROOM", payload: buildPayload() },
            numericHostId
          );
          throw new Error("Room already full");
        }
        // Else, add new player
        fastify.currentRoom.set(numericInviteeId, roomId);
        room.joinedPlayers.push({ id: numericInviteeId, username: username });
      }

      // Remove from invited players
      room.invitedPlayers = room.invitedPlayers.filter(
        (p) => Number(p.id) !== numericInviteeId
      );

      // Send update to invitee ONLY if accepted
      if (response === "accepted") {
        safeSend(
          inviteeSocket,
          { event: "JOIN_ROOM", payload: { roomId } },
          numericInviteeId
        );
        safeSend(
          inviteeSocket,
          { event: "GAME_ROOM", payload: buildPayload() },
          numericInviteeId
        );
      }

      // Notify host to update game room
      safeSend(
        hostSocket,
        { event: "GAME_ROOM", payload: buildPayload() },
        numericHostId
      );
    }
  );

  fastify.decorate("leaveRoom", (roomId, userId) => {
    const room = fastify.gameRooms.get(roomId);
    if (!room) return; // Not throwing error as we always run leave room when user log outs

    // Ensure userId is a number for consistent lookup
    const numericUserId = Number(userId);

    // Remove the user from joinedPlayers, invitedPlayers and currentRoom
    room.joinedPlayers = room.joinedPlayers.filter((p) => Number(p.id) !== numericUserId);
    room.invitedPlayers = room.invitedPlayers.filter((p) => Number(p.id) !== numericUserId);
    fastify.currentRoom.delete(numericUserId);

    // Handle tournament forfeit if this is a tournament room
    const tournamentId = room.code?.startsWith('RT-') ? `RT-${roomId}` : null;
    if (tournamentId && fastify.activeTournaments) {
      const tournament = fastify.activeTournaments.get(tournamentId);
      if (tournament) {
        // Find and forfeit all pending matches for this player
        const userIdStr = String(numericUserId);
        tournament.matches.forEach(match => {
          if (match.status === 'pending') {
            const isPlayer1 = String(match.player1.id) === userIdStr;
            const isPlayer2 = match.player2 && String(match.player2.id) === userIdStr;

            if (isPlayer1 || isPlayer2) {
              // Double-update protection: Check if match is already being processed
              if (match._forfeitProcessing) {
                console.log(`[Tournament] Match ${match.matchId} forfeit already being processed, skipping`);
                return;
              }
              match._forfeitProcessing = true;

              // Mark match as completed with forfeit
              match.status = 'completed';
              match.result = {
                outcome: 'forfeit',
                forfeitedBy: numericUserId,
                score: { p1: 0, p2: 0 }
              };

              // Award points to opponent (3 points for win by forfeit)
              if (isPlayer1 && match.player2) {
                tournament.updateStandings({
                  player1Id: match.player1.id,
                  player2Id: match.player2.id,
                  score: { p1: 0, p2: 5 }, // 5 indicates forfeit win (WIN_SCORE)
                  outcome: 'forfeit'
                });
              } else if (isPlayer2) {
                tournament.updateStandings({
                  player1Id: match.player1.id,
                  player2Id: match.player2.id,
                  score: { p1: 5, p2: 0 },
                  outcome: 'forfeit'
                });
              }

              console.log(`[Tournament] User ${numericUserId} forfeited match ${match.matchId}`);
            }
          }
        });
      }
    }

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
        };
        safeSend(
          newHostSocket,
          {
            event: "GAME_ROOM",
            payload,
          },
          room.hostId
        );
        safeSend(
          oldHostSocket,
          {
            event: "LEAVE_ROOM",
          },
          numericUserId
        );
      } else {
        fastify.gameRooms.delete(roomId);
        const oldHostSocket = fastify.onlineUsers.get(numericUserId);
        safeSend(
          oldHostSocket,
          {
            event: "LEAVE_ROOM",
          },
          numericUserId
        );
      }
    } else {
      const hostSocket = fastify.onlineUsers.get(Number(room.hostId));
      const userSocket = fastify.onlineUsers.get(numericUserId);
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
        Number(room.hostId)
      );
      safeSend(
        userSocket,
        {
          event: "LEAVE_ROOM",
        },
        numericUserId
      );
    }
  });

  // Join room by code (for remote play)
  fastify.decorate("joinRoomByCode", (roomIdInput, userId, username) => {
    const roomId = roomIdInput.trim();
    const room = fastify.gameRooms.get(roomId);
    if (!room) throw new Error("Room not found");

    // Ensure userId is a number for consistent lookup in onlineUsers
    const numericUserId = Number(userId);

    // Check if already in another room
    const existingRoom = fastify.currentRoom.get(numericUserId);
    if (existingRoom && existingRoom !== roomId) {
      throw new Error("Already in another room");
    }

    // Check if already in this room (compare as numbers)
    if (room.joinedPlayers.some((p) => Number(p.id) === numericUserId)) {
      // Already in room, just send room state
      const socket = fastify.onlineUsers.get(numericUserId);
      safeSend(socket, {
        event: "JOIN_ROOM",
        payload: { roomId, success: true },
      }, numericUserId);
      return;
    }

    // Check if room is full
    if (room.joinedPlayers.length >= room.maxPlayers) {
      throw new Error("Room is full");
    }

    // Add player to room with numeric ID for consistent lookup
    fastify.currentRoom.set(numericUserId, roomId);
    room.joinedPlayers.push({ id: numericUserId, username });

    // Notify the joining player
    const joinerSocket = fastify.onlineUsers.get(numericUserId);
    safeSend(joinerSocket, {
      event: "JOIN_ROOM",
      payload: { roomId, success: true },
    }, numericUserId);

    // Build room payload
    const payload = {
      roomId: roomId,
      hostId: room.hostId,
      invitedPlayers: room.invitedPlayers,
      joinedPlayers: room.joinedPlayers,
      maxPlayers: room.maxPlayers,
    };

    // Notify all players in the room (using numeric ID for lookup)
    console.log(`[joinRoomByCode] Notifying ${room.joinedPlayers.length} players:`, room.joinedPlayers.map(p => p.id));
    room.joinedPlayers.forEach((player) => {
      const playerNumId = Number(player.id);
      const socket = fastify.onlineUsers.get(playerNumId);
      console.log(`[joinRoomByCode] Player ${playerNumId} socket found: ${!!socket}`);
      safeSend(socket, { event: "GAME_ROOM", payload }, playerNumId);
    });
  });

  // Matchmaking queue
  const matchmakingQueue = {
    single: [],      // { userId, username, socket, joinedAt }
    tournament: [],
  };

  fastify.decorate("joinMatchmaking", (userId, username, mode) => {
    const queue = matchmakingQueue[mode];
    if (!queue) throw new Error("Invalid matchmaking mode");

    // Ensure userId is a number for consistent lookup
    const numericUserId = Number(userId);

    // Check if already in queue
    if (queue.some((p) => p.userId === numericUserId)) {
      return; // Already in queue
    }

    // Check if already in a room
    if (fastify.currentRoom.get(numericUserId)) {
      throw new Error("Already in a room");
    }

    const socket = fastify.onlineUsers.get(numericUserId);

    // For tournament mode: first try to find an existing available tournament room
    if (mode === "tournament") {
      // Find an available tournament room (not started, has space, is matchmade tournament)
      let availableRoom = null;
      let availableRoomId = null;

      for (const [roomId, room] of fastify.gameRooms.entries()) {
        // Check if it's a tournament room waiting for players
        if (
          room.isTournament &&
          room.isMatchmade &&
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

        console.log(`[Matchmaking] User ${numericUserId} joined existing tournament room ${availableRoomId}`);

        // Send TOURNAMENT_FOUND to the new player
        safeSend(socket, {
          event: "TOURNAMENT_FOUND",
          payload: {
            roomId: availableRoomId,
            tournamentId: `RT-${availableRoomId}`,
            players: availableRoom.joinedPlayers,
          },
        }, numericUserId);

        // Notify all existing players about the new player
        const payload = {
          roomId: availableRoomId,
          hostId: availableRoom.hostId,
          invitedPlayers: availableRoom.invitedPlayers,
          joinedPlayers: availableRoom.joinedPlayers,
          maxPlayers: availableRoom.maxPlayers,
        };

        availableRoom.joinedPlayers.forEach((player) => {
          const playerSocket = fastify.onlineUsers.get(Number(player.id));
          safeSend(playerSocket, { event: "GAME_ROOM", payload }, Number(player.id));
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
        isTournament: true,
        tournamentStarted: false,
      });

      console.log(`[Matchmaking] User ${numericUserId} created new tournament room ${roomId}`);

      // Send TOURNAMENT_FOUND to the host
      safeSend(socket, {
        event: "TOURNAMENT_FOUND",
        payload: {
          roomId,
          tournamentId: `RT-${roomId}`,
          players: [{ id: numericUserId, username }],
          isHost: true,
        },
      }, numericUserId);

      return; // Don't add to queue since we created a room
    }

    // For single mode: Search for available room, or create one
    if (mode === "single") {
      // Search for an available matchmade room (host waiting)
      let availableRoom = null;
      let availableRoomId = null;

      for (const [roomId, room] of fastify.gameRooms.entries()) {
        if (
          !room.isTournament &&
          room.isMatchmade &&
          room.joinedPlayers.length < room.maxPlayers
        ) {
          availableRoom = room;
          availableRoomId = roomId;
          break;
        }
      }

      if (availableRoom) {
        // Join the existing room
        fastify.currentRoom.set(numericUserId, availableRoomId);
        availableRoom.joinedPlayers.push({ id: numericUserId, username });

        console.log(`[Matchmaking] User ${numericUserId} matched into room ${availableRoomId}`);

        // Start the game immediately
        // This initializes game state and sends GAME_MATCH_START to both players
        // which triggers the redirect to the game page.
        if (fastify.startRoomGame) {
          fastify.startRoomGame(availableRoomId);
        } else {
          console.error("[Matchmaking] fastify.startRoomGame is not defined!");
          // Fallback: Send MATCH_FOUND as before (though it might hang if no state)
          const payload = {
            event: "MATCH_FOUND",
            payload: {
              roomId: availableRoomId,
              matchId: `RS-${availableRoomId}`,
              players: availableRoom.joinedPlayers
            }
          };
          availableRoom.joinedPlayers.forEach(p => {
            const s = fastify.onlineUsers.get(Number(p.id));
            if (s) safeSend(s, payload, Number(p.id));
          });
        }
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
        isTournament: false
      });

      console.log(`[Matchmaking] User ${numericUserId} created single room ${roomId}`);

      // Send GAME_ROOM so their context updates
      const roomPayload = {
        roomId: roomId,
        hostId: numericUserId,
        invitedPlayers: [],
        joinedPlayers: [{ id: numericUserId, username }],
        maxPlayers: 2
      };

      safeSend(socket, {
        event: "GAME_ROOM",
        payload: roomPayload
      }, numericUserId);

      // Tell them they are the host so they redirect to lobby
      safeSend(socket, {
        event: "MATCHMAKING_HOST",
        payload: { roomId }
      }, numericUserId);

      return;
    }

    // For tournament mode (queue fallback if needed, though joinMatchmaking handles it above):
    queue.push({ userId: numericUserId, username, socket, joinedAt: Date.now() });

    // Send confirmation
    safeSend(socket, {
      event: "MATCHMAKING_JOINED",
      payload: { mode, position: queue.length },
    }, numericUserId);

    // Try to match players
    fastify.tryMatchPlayers(mode);
  });

  fastify.decorate("leaveMatchmaking", (userId) => {
    // Remove from both queues
    matchmakingQueue.single = matchmakingQueue.single.filter((p) => p.userId !== userId);
    matchmakingQueue.tournament = matchmakingQueue.tournament.filter((p) => p.userId !== userId);

    const socket = fastify.onlineUsers.get(userId);
    if (socket) {
      safeSend(socket, { event: "MATCHMAKING_LEFT" }, userId);
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
          joinedPlayers: players.map((p) => ({ id: p.userId, username: p.username })),
          maxPlayers: 8,
          isMatchmade: true,
          isTournament: true,
        });

        const payload = {
          event: "TOURNAMENT_FOUND",
          payload: {
            roomId,
            tournamentId: `RT-${roomId}`,
            players: players.map((p) => ({ id: p.userId, username: p.username })),
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
    const room = fastify.gameRooms.get(roomId);
    if (!room) throw new Error("Room not found");
    if (room.joinedPlayers.length < 3) throw new Error("Need at least 3 players for a tournament");

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

    console.log(`Tournament ${tournamentId} started with ${room.joinedPlayers.length} players`);
  });
});

