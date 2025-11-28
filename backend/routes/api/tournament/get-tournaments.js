import { PrismaClient } from "../../../generated/prisma/index.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  // Get all tournaments for the authenticated user
  fastify.get(
    "/",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const userId = request.user.userId;

        const tournaments = await prisma.tournament.findMany({
          where: {
            players: {
              some: {
                id: userId,
              },
            },
          },
          include: {
            winner: {
              select: {
                id: true,
                username: true,
              },
            },
            players: {
              select: {
                id: true,
                username: true,
              },
            },
            matches: {
              include: {
                player1: {
                  select: {
                    id: true,
                    username: true,
                  },
                },
                player2: {
                  select: {
                    id: true,
                    username: true,
                  },
                },
              },
            },
          },
          orderBy: {
            date: 'desc',
          },
        });

        return reply.code(200).send(tournaments);
      } catch (error) {
        console.error("Error fetching tournaments:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
