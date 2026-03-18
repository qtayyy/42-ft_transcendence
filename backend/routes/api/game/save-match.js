import { persistMatchRecord } from "../../../services/match-persistence.js";

export default async function (fastify, opts) {
	fastify.post(
		"/save-match",
		{
			onRequest: [fastify.authenticate],
		},
		async (request, reply) => {
			try {
				const authenticatedUserId = Number(request.user.userId);
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
					tournamentId,
					durationSeconds,
				} = request.body;
				const normalizedMode =
					typeof mode === "string" ? mode.trim().toUpperCase().replace(/-/g, "_") : "LOCAL";
				const resolvedPlayer1Id =
					normalizedMode === "LOCAL" || normalizedMode === "LOCAL_TOURNAMENT"
						? authenticatedUserId
						: (player1Id ?? authenticatedUserId);

				// Validation
				if (score1 === undefined || score2 === undefined) {
					return reply.code(400).send({ error: "Scores are required" });
				}

				const { match, reusedExisting } = await persistMatchRecord({
					externalMatchId: matchId,
					player1Id: resolvedPlayer1Id,
					player2Id: player2Id ?? null,
					score1,
					score2,
					durationSeconds,
					mode: normalizedMode,
					tournamentId: tournamentId || null,
				});

				return reply.code(200).send({
					success: true,
					matchId: match.id,
					externalMatchId: match.externalMatchId,
					reusedExisting,
					message: reusedExisting ? "Match already persisted; existing row reused" : "Match saved successfully"
				});

			} catch (error) {
				console.error("Error saving match:", error);
				return reply.code(500).send({ error: "Failed to save match" });
			}
		}
	);
}
