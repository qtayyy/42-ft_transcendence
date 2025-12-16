import { PrismaClient } from "../../../generated/prisma/index.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
	fastify.post(
		"/save-match",
		{
			onRequest: [fastify.authenticate],
		},
		async (request, reply) => {
			try {
				const {
					matchId,
					player1Id,
					player2Id,
					player1Name,
					player2Name,
					score1,
					score2,
					winner,
					mode,
					tournamentId
				} = request.body;

				// Validation
				if (score1 === undefined || score2 === undefined) {
					return reply.code(400).send({ error: "Scores are required" });
				}

				// Save match - allow null player IDs for temporary players
				const match = await prisma.match.create({
					data: {
						player1Id: player1Id || null,
						player2Id: player2Id || null,
						score1: score1,
						score2: score2,
						mode: mode || "LOCAL",
						tournamentId: tournamentId || null,
					}
				});

				return reply.code(200).send({
					success: true,
					matchId: match.id,
					message: "Match saved successfully"
				});

			} catch (error) {
				console.error("Error saving match:", error);
				return reply.code(500).send({ error: "Failed to save match" });
			}
		}
	);
}
