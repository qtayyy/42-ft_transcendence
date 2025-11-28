import { PrismaClient } from "../../../generated/prisma/index.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  fastify.post(
    "/save",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const { tournamentId, player1Id, player2Id, score1, score2 } = request.body;

        console.log("Received match save request:", {
          tournamentId,
          player1Id,
          player2Id,
          score1,
          score2,
          bodyType: typeof request.body,
          body: request.body,
        });

        if (!tournamentId || !player1Id || !player2Id || score1 === undefined || score2 === undefined) {
          console.log("Validation failed - missing fields:", {
            hasTournamentId: !!tournamentId,
            hasPlayer1Id: !!player1Id,
            hasPlayer2Id: !!player2Id,
            hasScore1: score1 !== undefined,
            hasScore2: score2 !== undefined,
          });
          return reply.code(400).send({ error: "Missing required fields" });
        }

        // Create the match record
        const match = await prisma.match.create({
          data: {
            tournamentId,
            player1Id,
            player2Id,
            score1,
            score2,
          },
        });

        // Determine winner and update tournament if game is complete
        const winnerId = score1 > score2 ? player1Id : player2Id;
        
        await prisma.tournament.update({
          where: { id: tournamentId },
          data: { winnerId },
        });

        return reply.code(200).send({
          message: "Match saved successfully",
          matchId: match.id,
        });
      } catch (error) {
        console.error("Error saving match:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
