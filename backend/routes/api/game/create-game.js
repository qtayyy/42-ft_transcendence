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
        const players = request.body;
        // I only handle 2 players now
        if (players.length !== 2)
          return reply
            .code(400).send({error: "Two players required"});

        // Create a single tournament for all players
        const tournament = await prisma.tournament.create({
          data: {
            players: {
              connect: players.map((player) => ({ id: player.id })),
            },
          },
        });

        // Shuffle the players (For > 2 players)
        players.sort(() => Math.random() - 0.5);

        // Hard-coded for even num of players (need to handle 3 players)
        const pairs = [[players[0], players[1]]];
        const matches = await prisma.$transaction(
          pairs.map(([p1, p2]) =>
            prisma.match.create({
              data: {
                player1Id: p1.id,
                player2Id: p2.id,
                score1: 0,
                score2: 0,
                tournamentId: tournament.id,
              },
              include: {
                player1: { select: { username: true } },
                player2: { select: { username: true } },
              },
            })
          )
        );

        fastify.dispatchMatches(matches);

        reply.code(200).send({ success: true });
      } catch (error) {
        // To-do: Handle errors properly
        throw error;
      }
    }
  );
}
