import { PrismaClient } from "/app/generated/prisma/index.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  fastify.get(
    "/:friendId",
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const myId = request.user.userId;
        const friendId = parseInt(request.params.friendId);

        if (!friendId || isNaN(friendId)) {
          return reply.code(400).send({ error: "Invalid friend ID" });
        }

        // Verify friendship exists
        const friendship = await prisma.friendship.findFirst({
          where: {
            status: "ACCEPTED",
            OR: [
              { requesterId: myId, addresseeId: friendId },
              { requesterId: friendId, addresseeId: myId },
            ],
          },
        });

        if (!friendship) {
          return reply.code(403).send({ error: "Not friends with this user" });
        }

        // Get all messages between the two users
        const messages = await prisma.message.findMany({
          where: {
            OR: [
              { senderId: myId, recipientId: friendId },
              { senderId: friendId, recipientId: myId },
            ],
          },
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
            recipient: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        });

        // Format messages for frontend
        const formattedMessages = messages.map((msg) => ({
          id: msg.id,
          username: msg.sender.username,
          senderId: msg.senderId,
          avatar: msg.sender.avatar || null,
          message: msg.content,
          timestamp: msg.createdAt.toISOString(),
        }));

        return reply.code(200).send(formattedMessages);
      } catch (error) {
        console.error("Error fetching chat history:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}

