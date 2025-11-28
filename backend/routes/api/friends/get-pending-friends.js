import { PrismaClient } from "../../../generated/prisma/index.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  fastify.get(
    "/pending",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const userId = request.user.userId;

        const pendingFriends = await prisma.friendship.findMany({
          where: {
            status: "PENDING",
            addresseeId: userId,
          },
          include: {
            requester: { select: { id: true, username: true } },
          },
        });

        return reply.code(200).send(pendingFriends);
      } catch (error) {
        console.error("Error fetching friends:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
