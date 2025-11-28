import { PrismaClient } from "../../../generated/prisma/index.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  // Get all matches for the authenticated user
  fastify.get(
    "/",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const userId = request.user.userId;

        const matches = await prisma.match.findMany({
          where: {
            OR: [
              { player1Id: userId },
              { player2Id: userId },
            ],
          },
          include: {
            player1: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
            player2: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
            tournament: {
              select: {
                id: true,
                date: true,
              },
            },
          },
          orderBy: {
            id: 'desc',
          },
        });

        return reply.code(200).send(matches);
      } catch (error) {
        console.error("Error fetching matches:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
