import { PrismaClient } from "../../../generated/prisma/index.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  fastify.get(
    "/",
    { onRequest: [fastify.authenticate] },

    async (request, reply) => {
      try {
        const myId = request.user.userId;

        // Get all blocked user IDs (both ways)
        const blockedUsers = await prisma.block.findMany({
          where: {
            OR: [
              { blockerId: myId },
              { blockedId: myId },
            ],
          },
          select: {
            blockerId: true,
            blockedId: true,
          },
        });

        const blockedIds = new Set();
        blockedUsers.forEach((block) => {
          if (block.blockerId === myId) {
            blockedIds.add(block.blockedId);
          } else {
            blockedIds.add(block.blockerId);
          }
        });

        const friends = await prisma.friendship.findMany({
          where: {
            status: "ACCEPTED",
            OR: [{ requesterId: myId }, { addresseeId: myId }],
          },
          include: {
            requester: { select: { id: true, username: true, avatar: true } },
            addressee: { select: { id: true, username: true, avatar: true } },
          },
        });
        
        // Filter out blocked users
        const cleanedFriends = friends
          .map((f) => f.requesterId === myId ? f.addressee : f.requester)
          .filter((friend) => !blockedIds.has(friend.id));
        
        return reply.code(200).send(cleanedFriends);
      } catch (error) {
        console.error("Error fetching friends:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
