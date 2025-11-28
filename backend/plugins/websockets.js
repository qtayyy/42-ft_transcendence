import fp from "fastify-plugin";
import websocket from "@fastify/websocket";
import { PrismaClient } from '/app/generated/prisma/index.js';

const prisma = new PrismaClient();

export default fp(async (fastify) => {
  fastify.register(websocket);

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
});
