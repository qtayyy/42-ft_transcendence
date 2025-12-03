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
    console.log("gameroom created: ", fastify.gameRooms.get(roomId));
    return roomId;
  });

  fastify.decorate("sendGameRoom", (userId) => {
    const roomId = fastify.currentRoom.get(userId);
    if (!roomId) return;
    const room = fastify.gameRooms.get(roomId);
    if (!room) throw new Error(`Room ${roomId} doesn't exist`);

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
        // If room is full, remove extra "pending" pl
        // ayers from host's page and inform
        // invitee that room is full.
        if (room.joinedPlayers.size === room.maxPlayers) {
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
        fastify.currentRoom.set(inviteeId, room.id);
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
    if (!room) throw new Error("Room does not exist");

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
});
