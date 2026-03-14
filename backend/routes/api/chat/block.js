import { PrismaClient } from "../../../generated/prisma/index.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  // Block a user
  fastify.post(
    "/block",
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const myId = request.user.userId;
        const { userId } = request.body;

        if (!userId || isNaN(parseInt(userId))) {
          return reply.code(400).send({ error: "Invalid user ID" });
        }

        const blockedId = parseInt(userId);

        if (myId === blockedId) {
          return reply.code(400).send({ error: "Cannot block yourself" });
        }

        // Check if already blocked
        const existingBlock = await prisma.block.findUnique({
          where: {
            blockerId_blockedId: {
              blockerId: myId,
              blockedId: blockedId,
            },
          },
        });

        if (existingBlock) {
          return reply.code(400).send({ error: "User already blocked" });
        }

        // Remove any existing friendship
        await prisma.friendship.deleteMany({
          where: {
            OR: [
              { requesterId: myId, addresseeId: blockedId },
              { requesterId: blockedId, addresseeId: myId },
            ],
          },
        });

        // Create block
        await prisma.block.create({
          data: {
            blockerId: myId,
            blockedId: blockedId,
          },
        });

        return reply
          .code(200)
          .send({ message: "User blocked successfully" });
      } catch (error) {
        console.error("Error blocking user:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    },
  );

  // Unblock a user
  fastify.delete(
    "/block/:userId",
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const myId = request.user.userId;
        const blockedId = parseInt(request.params.userId);

        if (!blockedId || isNaN(blockedId)) {
          return reply.code(400).send({ error: "Invalid user ID" });
        }

        // Delete block
        const deleted = await prisma.block.deleteMany({
          where: {
            blockerId: myId,
            blockedId: blockedId,
          },
        });

        if (deleted.count === 0) {
          return reply.code(404).send({ error: "Block not found" });
        }

        return reply
          .code(200)
          .send({ message: "User unblocked successfully" });
      } catch (error) {
        console.error("Error unblocking user:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    },
  );

  // Get list of blocked users
  fastify.get(
    "/block",
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const myId = request.user.userId;

        const blocks = await prisma.block.findMany({
          where: {
            blockerId: myId,
          },
          include: {
            blocked: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
          },
        });

        const blockedUsers = blocks.map((block) => ({
          id: block.blocked.id.toString(),
          username: block.blocked.username,
          avatar: block.blocked.avatar,
          blockedAt: block.createdAt.toISOString(),
        }));

        return reply.code(200).send(blockedUsers);
      } catch (error) {
        console.error("Error fetching blocked users:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    },
  );
}
