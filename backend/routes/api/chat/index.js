import { PrismaClient } from "../../../generated/prisma/index.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  // Register block routes
  const blockModule = await import("./block.js");
  await fastify.register(blockModule.default);

  // Register read routes  
  const readModule = await import("./read.js");
  await fastify.register(readModule.default);

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

        // Check if either user has blocked the other
        const blockExists = await prisma.block.findFirst({
          where: {
            OR: [
              { blockerId: myId, blockedId: friendId },
              { blockerId: friendId, blockedId: myId },
            ],
          },
        });

        if (blockExists) {
          return reply
            .code(403)
            .send({ error: "Cannot access chat with blocked user" });
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
          read: msg.read,
          readAt: msg.readAt?.toISOString() || null,
        }));

        return reply.code(200).send(formattedMessages);
      } catch (error) {
        console.error("Error fetching chat history:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    },
  );
}
