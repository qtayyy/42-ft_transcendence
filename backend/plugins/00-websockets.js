import fp from "fastify-plugin";
import websocket from "@fastify/websocket";
<<<<<<< HEAD:backend/plugins/00-websockets.js
import { activeTournaments } from "../game/TournamentManager.js";
=======
import { PrismaClient } from '/app/generated/prisma/index.js';

const prisma = new PrismaClient();
>>>>>>> 3b7dd28 (merge: merge main branch):backend/plugins/websockets.js

export default fp(async (fastify) => {
  fastify.register(websocket);

<<<<<<< HEAD:backend/plugins/00-websockets.js
  // userId: Set of sockets (to handle multiple tabs)
  const onlineUsers = new Map();

  // hostId: GameRoom object
  const gameRooms = new Map();

  // Track which room each user is currently in
  //    userId: roomId
  const currentRoom = new Map();

  // matchId: gameState
  const gameStates = new Map();

  // Track lobby removal timeouts (userId: timeout)
  const lobbyDisconnectTimeouts = new Map();

  fastify.decorate("onlineUsers", onlineUsers);
  fastify.decorate("gameRooms", gameRooms);
  fastify.decorate("currentRoom", currentRoom);
  fastify.decorate("gameStates", gameStates);
  fastify.decorate("lobbyDisconnectTimeouts", lobbyDisconnectTimeouts);

  // Shared active tournaments map
  fastify.decorate("activeTournaments", activeTournaments);
=======
  // Map to store all users who're online
  const onlineUsers = new Map();

  fastify.decorate("onlineUsers", onlineUsers);

  fastify.decorate("notifyFriendReq", (userId, payload) => {
    const conn = onlineUsers.get(userId);
    if (conn) {
      try {
        conn.send(JSON.stringify(payload));
      } catch (error) {
        console.log("WS send error:", error);
      }
    }
  });

  fastify.decorate("notifyFriendStatus", async (userId, status) => {

    const friends = await prisma.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      include: {
        requester: { select: { id: true, username: true } },
        addressee: { select: { id: true, username: true } },
      },
    });

    friends.forEach((f) => {
      const friendId = f.requesterId === userId ? f.addresseeId : f.requesterId;
      const friendSocket = onlineUsers.get(friendId);
      if (friendSocket) {
        friendSocket.send(
          JSON.stringify({
            event: "FRIEND_STATUS",
            payload: { username: f.requester.username, status },
          })
        );
      }
    });
  });
>>>>>>> 3b7dd28 (merge: merge main branch):backend/plugins/websockets.js
});
