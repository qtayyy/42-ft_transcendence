import { finalizeMatchResult } from "../../../services/match-finalization.js";
import {
	MATCH_SCORE_MAX,
	MATCH_SCORE_MIN,
	normalizeRuntimeId,
} from "../../../lib/local-play-validation.js";

function normalizeScore(value, label) {
	const score = Number(value);
	if (!Number.isInteger(score) || score < MATCH_SCORE_MIN || score > MATCH_SCORE_MAX) {
		throw new Error(`${label} must be a whole number from ${MATCH_SCORE_MIN} to ${MATCH_SCORE_MAX}.`);
	}
	return score;
}

function normalizeDurationSeconds(value) {
	if (value === null || value === undefined || value === "") {
		return null;
	}
	const duration = Number(value);
	if (!Number.isFinite(duration) || duration < 0 || duration > 86400) {
		throw new Error("Match duration is invalid.");
	}
	return Math.round(duration);
}

export default async function (fastify, opts) {
	fastify.post(
		"/save-match",
		{
			onRequest: [fastify.authenticate],
		},
		async (request, reply) => {
			try {
				const authenticatedUserId = Number(request.user.userId);
				if (!request.body || typeof request.body !== "object" || Array.isArray(request.body)) {
					return reply.code(400).send({ error: "Match save body is invalid." });
				}

				const {
					matchId,
					player1Id,
					player2Id,
					score1: rawScore1,
					score2: rawScore2,
					mode,
					tournamentId,
					durationSeconds: rawDurationSeconds,
				} = request.body;

				const normalizedMatchId = normalizeRuntimeId(matchId, "Match ID");
				const score1 = normalizeScore(rawScore1, "Player 1 score");
				const score2 = normalizeScore(rawScore2, "Player 2 score");
				const durationSeconds = normalizeDurationSeconds(rawDurationSeconds);

				const normalizedMode = typeof mode === "string" ? mode.trim().toUpperCase().replace(/-/g, "_") : "LOCAL";
				const resolvedPlayer1Id = normalizedMode === "LOCAL" || normalizedMode === "LOCAL_TOURNAMENT"
					? authenticatedUserId
					: (player1Id ?? authenticatedUserId);

				const { match, reusedExisting, progressionApplied } = await finalizeMatchResult({
					externalMatchId: normalizedMatchId,
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
				if (error.statusCode === 400 || error.message?.includes("must be") || error.message?.includes("invalid")) {
					return reply.code(400).send({ error: error.message });
				}
				console.error("Error saving match:", error);
				return reply.code(500).send({ error: "Failed to save match" });
			}
		}
	);
}
