import { gameManager } from "../../../game/GameManager.js";
import { activeTournaments } from "../../../game/TournamentManager.js";

export default async function (fastify, opts) {
	fastify.post(
		"/leave",
		{
			onRequest: [fastify.authenticate],
		},
		async (request, reply) => {
			try {
				const userId = request.user.userId;
				const { matchId, tournamentId } = request.body;

				console.log(`User ${userId} requested to leave/forfeit match ${matchId} (Tournament: ${tournamentId || 'N/A'})`);

				// 1. Prioritize WebSocket Game State (Active Game managed by WS plugin)
				if (fastify.forfeitMatch) {
					try {
						fastify.forfeitMatch(matchId, userId);
						return reply.send({ success: true, message: "Game forfeited." });
					} catch (err) {
						console.log(`[Leave] active WS game not found for ${matchId} (or not in it). Checking legacy/tournament fallbacks.`);
					}
				}

				// 2. Check Legacy Game Manager instance
				const game = gameManager.getGame(matchId);
				if (game) {
					console.log(`Found running legacy game instance for ${matchId}. Forfeiting...`);
					game.forfeit(userId);
					return reply.send({ success: true, message: "Game forfeited." });
				}

				// 2. If Game instance is not found (maybe server rebooted? or logic desync?), 
				// fallback to Tournament Manager logic to ensure result is recorded
				if (tournamentId) {
					const tournament = activeTournaments.get(tournamentId);
					if (tournament) {
						const match = tournament.matches.find(m => m.matchId === matchId);

						// Only act if match is in progress or pending?
						// If user is "leaving" a pending match, it might just be leaving the lobby.
						// But request specifically said "If it is a tournament, end the match... announce other user as winner"

						if (match && match.status !== 'completed') {
							console.log(`Forfeiting tournament match (no active game loop found)`);

							const p1Id = match.player1.id;
							const p2Id = match.player2 ? match.player2.id : null;

							// If p2 is null (bye), nothing to forfeit really
							if (!p2Id) return reply.send({ success: true });

							const isP1 = String(p1Id) === String(userId);

							// Simulate score for forfeit (5-0)
							const score = {
								p1: isP1 ? 0 : 5,
								p2: isP1 ? 5 : 0
							};

							tournament.updateMatchResult(matchId, score, 'forfeit'); // 'forfeit' calls updateStandings
							return reply.send({ success: true, message: "Tournament match forfeited." });
						}
					}
				}

				return reply.send({ success: false, message: "Match not found or already completed." });
			} catch (error) {
				console.error("Leave game error:", error);
				return reply.code(500).send({ error: "Failed to leave game" });
			}
		}
	);
}
