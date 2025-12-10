import { PrismaClient } from "/app/generated/prisma/index.js";
import fp from "fastify-plugin";
import { safeSend } from "../../utils/ws-utils.js";

const prisma = new PrismaClient();

export default fp(async (fastify) => {
  fastify.decorate("notifyFriendReq", (addresseeId, payload) => {
    const conn = fastify.onlineUsers.get(addresseeId);
    safeSend(conn, payload, addresseeId);
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
      const friendSocket = fastify.onlineUsers.get(friendId);
      if (!friendSocket) return;

      safeSend(
        friendSocket,
        {
          event: "FRIEND_STATUS",
          payload: {
            id: userId,
            username:
              f.requesterId === userId
                ? f.requester.username
                : f.addressee.username,
            status,
          },
        },
        friendId
      );
    });
  });
});
