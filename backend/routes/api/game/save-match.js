import { finalizeMatchResult } from "../../../services/match-finalization.js";

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
					score1,
					score2,
					mode,
					tournamentId,
					durationSeconds,
				} = request.body;

				// Validation
				if (score1 === undefined || score2 === undefined) {
					return reply.code(400).send({ error: "Scores are required" });
				}

				const normalizedMode = typeof mode === "string" ? mode.trim().toUpperCase().replace(/-/g, "_") : "LOCAL";
				const resolvedPlayer1Id = normalizedMode === "LOCAL" || normalizedMode === "LOCAL_TOURNAMENT"
					? authenticatedUserId
					: (player1Id ?? authenticatedUserId);

				const { match, reusedExisting, progressionApplied } = await finalizeMatchResult({
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
					reusedExisting,
					progressionApplied,
					message: reusedExisting
						? "Match already finalized"
						: "Match saved and progression updated"
				});

			} catch (error) {
				console.error("Error saving match:", error);
				return reply.code(500).send({ error: "Failed to save match" });
			}
		}
	);
}
