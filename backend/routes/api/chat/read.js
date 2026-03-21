import { PrismaClient } from "../../../generated/prisma/index.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  // Mark messages as read
  fastify.post(
    "/read/:friendId",
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const myId = Number(request.user.userId);
        const friendId = parseInt(request.params.friendId);

        if (!friendId || isNaN(friendId)) {
          return reply.code(400).send({ error: "Invalid friend ID" });
        }

        // Mark all unread messages from this friend as read
        const updated = await prisma.message.updateMany({
          where: {
            senderId: friendId,
            recipientId: myId,
            read: false,
          },
          data: {
            read: true,
            readAt: new Date(),
          },
        });

        return reply.code(200).send({ 
          message: "Messages marked as read",
          count: updated.count
        });
      } catch (error) {
        console.error("Error marking messages as read:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    },
  );

  // Get unread message count
  fastify.get(
    "/unread",
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const myId = Number(request.user.userId);

        const unreadCount = await prisma.message.count({
          where: {
            recipientId: myId,
            read: false,
          },
        });

        return reply.code(200).send({ unreadCount });
      } catch (error) {
        console.error("Error fetching unread count:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    },
  );

  // Get unread message counts grouped by sender (friend)
  fastify.get(
    "/unread/by-friend",
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const myId = Number(request.user.userId);

        const groupedUnread = await prisma.message.groupBy({
          by: ["senderId"],
          where: {
            recipientId: myId,
            read: false,
          },
          _count: {
            _all: true,
          },
        });

        const unreadByFriend = groupedUnread.reduce((acc, entry) => {
          acc[String(entry.senderId)] = entry._count._all;
          return acc;
        }, {});

        return reply.code(200).send({ unreadByFriend });
      } catch (error) {
        console.error("Error fetching unread counts by friend:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    },
  );
}
