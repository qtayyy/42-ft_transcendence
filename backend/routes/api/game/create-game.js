import { PrismaClient } from "../../../generated/prisma/index.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  fastify.post(
    "/create",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const data = request.body;
        const userIds = data.map((item) => item.userId);
        // Get all the users that joined the tournament
        const players = await prisma.user.findMany({
          where: { id: { in: userIds, },},
        });
        // Create a single tournament in all of those users
        const tournament = await prisma.tournaments.create({
          data: {
            players: {
              connect: players.map((player) => ({ id: player.id })),
            },
          },
        });
        return reply.code(200).send({
          tournamentId: tournament.id,
        });
      } catch (error) {
        throw error;
      }
    }
  );
}
