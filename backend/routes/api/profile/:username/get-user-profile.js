import { PrismaClient } from "../../../../generated/prisma/index.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  fastify.get(
    "/",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const { username } = request.params;
        
        if (!username) {
          return reply.code(400).send({ error: "Username is required" });
        }

        const profile = await prisma.profile.findUnique({
          where: { username: username },
          select: {
            id: true,
            username: true,
            fullname: true,
            email: true,
            avatar: true,
            region: true,
            bio: true,
            dob: true,
            matchesAsPlayer1: {
              select: {
                score1: true,
                score2: true,
              },
            },
            matchesAsPlayer2: {
              select: {
                score1: true,
                score2: true,
              },
            },
          },
        });

        if (!profile) {
          return reply.code(404).send({ error: "User not found" });
        }

        // Calculate wins and losses
        let wins = 0;
        let losses = 0;

        // Count wins/losses as player1
        profile.matchesAsPlayer1.forEach((match) => {
          if (match.score1 > match.score2) wins++;
          else if (match.score1 < match.score2) losses++;
        });

        // Count wins/losses as player2
        profile.matchesAsPlayer2.forEach((match) => {
          if (match.score2 > match.score1) wins++;
          else if (match.score2 < match.score1) losses++;
        });

        // Remove match data and add calculated stats
        const { matchesAsPlayer1, matchesAsPlayer2, ...profileData } = profile;

        return reply.code(200).send({
          ...profileData,
          wins,
          losses,
        });

      } catch (error) {
        console.error("Error fetching user profile:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
