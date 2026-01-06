import { PrismaClient } from "/app/generated/prisma/index.js";
import fp from "fastify-plugin";
import crypto from "crypto";
import { safeSend } from "../../utils/ws-utils.js";

const prisma = new PrismaClient();

export default fp((fastify) => {
  fastify.decorate("createGameRoom", (hostId, hostUsername, maxPlayers) => {
    const roomId = crypto.randomUUID();
    fastify.currentRoom.set(hostId, roomId);

    fastify.gameRooms.set(roomId, {
      hostId,
      invitedPlayers: [],
      joinedPlayers: [{ id: hostId, username: hostUsername }],
      maxPlayers,
    });
    return roomId;
  });

  fastify.decorate("sendGameRoom", (userId) => {
    const roomId = fastify.currentRoom.get(userId);
    if (!roomId) return;
    const room = fastify.gameRooms.get(roomId);
    if (!room) {
      const socket = fastify.onlineUsers.get(userId);
      safeSend(socket, { event: "ROOM_NOT_FOUND" }, userId);
      return;
    }

    const isHost = userId === room.hostId;
    const isJoined = room.joinedPlayers.some((p) => p.id === userId);

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

    const socket = fastify.onlineUsers.get(userId);
    safeSend(
      socket,
      {
        event: "GAME_ROOM",
        payload,
      },
      userId
    );
  });

  fastify.decorate(
    "sendGameInvite",
    (roomId, hostId, hostUsername, friendId, friendUsername) => {
      const inviteeInRoom = fastify.currentRoom.get(friendId);
      if (inviteeInRoom) throw new Error("Player already in another room");

      const room = fastify.gameRooms.get(roomId);
      room.invitedPlayers.push({ id: friendId, username: friendUsername });

      // Send game invite to invitee
      const inviteeSocket = fastify.onlineUsers.get(friendId);
      safeSend(
        inviteeSocket,
        {
          event: "GAME_INVITE",
          payload: { roomId, hostId, hostUsername },
        },
        friendId
      );

      // Send updated game room to host
      const hostSocket = fastify.onlineUsers.get(hostId);
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
        hostId
      );
    }
  );

  fastify.decorate(
    "respondInvite",
    (response, roomId, hostId, inviteeId, username) => {
      const room = fastify.gameRooms.get(roomId);
      if (!room) throw new Error("Room does not exist");

      if (!room.invitedPlayers.some((p) => p.id === inviteeId)) {
        throw new Error("Player not invited to this room");
      }

      if (fastify.currentRoom.get(inviteeId))
        throw new Error("Already in another game room");

      const hostSocket = fastify.onlineUsers.get(hostId);
      const inviteeSocket = fastify.onlineUsers.get(inviteeId);

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
            (p) => p.id !== inviteeId
          );
          safeSend(
            hostSocket,
            { event: "GAME_ROOM", payload: buildPayload() },
            hostId
          );
          throw new Error("Room already full");
        }
        // Else, add new player
        fastify.currentRoom.set(inviteeId, roomId);
        room.joinedPlayers.push({ id: inviteeId, username: username });
      }

      // Remove from invited players
      room.invitedPlayers = room.invitedPlayers.filter(
        (p) => p.id !== inviteeId
      );

      // Send update to invitee ONLY if accepted
      if (response === "accepted") {
        safeSend(
          inviteeSocket,
          { event: "JOIN_ROOM", payload: { roomId } },
          inviteeId
        );
        safeSend(
          inviteeSocket,
          { event: "GAME_ROOM", payload: buildPayload() },
          inviteeId
        );
      }

      // Notify host to update game room
      safeSend(
        hostSocket,
        { event: "GAME_ROOM", payload: buildPayload() },
        hostId
      );
    }
  );

  fastify.decorate("leaveRoom", (roomId, userId) => {
    const room = fastify.gameRooms.get(roomId);
    if (!room) return; // Not throwing error as we always run leave room when user log outs

    // Remove the user from joinedPlayers, invitedPlayers and currentRoom
    room.joinedPlayers = room.joinedPlayers.filter((p) => p.id !== userId);
    room.invitedPlayers = room.invitedPlayers.filter((p) => p.id !== userId);
    fastify.currentRoom.delete(userId);

    // If the user who left is the host, transfer host ownership if
    // there are any other players who've joined. Else destroy the room.
    if (room.hostId === userId) {
      if (room.joinedPlayers.length > 0) {
        room.hostId = room.joinedPlayers[0].id;
        const newHostSocket = fastify.onlineUsers.get(room.hostId);
        // old host socket
        const oldHostSocket = fastify.onlineUsers.get(userId);
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
          userId
        );
      } else {
        fastify.gameRooms.delete(roomId);
        const oldHostSocket = fastify.onlineUsers.get(userId);
        safeSend(
          oldHostSocket,
          {
            event: "LEAVE_ROOM",
          },
          userId
        );
      }
    } else {
      const hostSocket = fastify.onlineUsers.get(room.hostId);
      const userSocket = fastify.onlineUsers.get(userId);
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
        room.hostId
      );
      safeSend(
        userSocket,
        {
          event: "LEAVE_ROOM",
        },
        userId
      );
    }
  });

  // Join room by code (for remote play)
  fastify.decorate("joinRoomByCode", (roomId, userId, username) => {
    const room = fastify.gameRooms.get(roomId);
    if (!room) throw new Error("Room not found");

    // Check if already in another room
    const existingRoom = fastify.currentRoom.get(userId);
    if (existingRoom && existingRoom !== roomId) {
      throw new Error("Already in another room");
    }

    // Check if already in this room
    if (room.joinedPlayers.some((p) => p.id === userId)) {
      // Already in room, just send room state
      const socket = fastify.onlineUsers.get(userId);
      safeSend(socket, {
        event: "JOIN_ROOM",
        payload: { roomId, success: true },
      }, userId);
      return;
    }

    // Check if room is full
    if (room.joinedPlayers.length >= room.maxPlayers) {
      throw new Error("Room is full");
    }

    // Add player to room
    fastify.currentRoom.set(userId, roomId);
    room.joinedPlayers.push({ id: userId, username });

    // Notify the joining player
    const joinerSocket = fastify.onlineUsers.get(userId);
    safeSend(joinerSocket, {
      event: "JOIN_ROOM",
      payload: { roomId, success: true },
    }, userId);

    // Build room payload
    const payload = {
      roomId: roomId,
      hostId: room.hostId,
      invitedPlayers: room.invitedPlayers,
      joinedPlayers: room.joinedPlayers,
      maxPlayers: room.maxPlayers,
    };

    // Notify all players in the room
    room.joinedPlayers.forEach((player) => {
      const socket = fastify.onlineUsers.get(player.id);
      safeSend(socket, { event: "GAME_ROOM", payload }, player.id);
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

    // Check if already in queue
    if (queue.some((p) => p.userId === userId)) {
      return; // Already in queue
    }

    // Check if already in a room
    if (fastify.currentRoom.get(userId)) {
      throw new Error("Already in a room");
    }

    const socket = fastify.onlineUsers.get(userId);
    queue.push({ userId, username, socket, joinedAt: Date.now() });

    // Send confirmation
    safeSend(socket, {
      event: "MATCHMAKING_JOINED",
      payload: { mode, position: queue.length },
    }, userId);

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
});

