import { gameManager } from "../../../game/GameManager.js";
import { activeTournaments } from "../../../game/TournamentManager.js";

export default async function (fastify, opts) {
	fastify.get(
		"/status",
		{
			onRequest: [fastify.authenticate],
		},
		async (request, reply) => {
			try {
				const userId = request.user.userId;

				// 1. Check Active Tournament Matches
				for (const [tournamentId, tournament] of activeTournaments) {
					// Check if user is in this tournament
					if (!tournament.players.some(p => String(p.id) === String(userId))) {
						continue;
					}

					// Check for active match (inprogress)
					const activeMatch = tournament.matches.find(m =>
						m.status === 'inprogress' &&
						(String(m.player1.id) === String(userId) || (m.player2 && String(m.player2.id) === String(userId)))
					);

					if (activeMatch) {
						const opponent = String(activeMatch.player1.id) === String(userId)
							? activeMatch.player2
							: activeMatch.player1;

						return reply.send({
							active: true,
							type: 'tournament',
							tournamentId: tournament.tournamentId,
							matchId: activeMatch.matchId,
							opponent: opponent ? opponent.name : 'Unknown',
							message: `You are in an active tournament match against ${opponent ? opponent.name : 'Unknown'}.`
						});
					}
				}

				// 2. Check Active Games (Remote via Fastify State)
				// The WebSocket implementation uses fastify.gameStates, not gameManager.activeGames
				if (fastify.gameStates) {
					// console.log(`[Status] Checking gameStates. Size: ${fastify.gameStates.size}`);
					// console.log(`[Status] GameState Keys: ${[...fastify.gameStates.keys()].join(', ')}`);

					for (const [matchId, gameState] of fastify.gameStates.entries()) {
						// if (!gameState.isRemote) continue; // Removed check to match connect-ws logic

						const leftId = gameState.leftPlayer?.id;
						const rightId = gameState.rightPlayer?.id;

						// Ensure IDs are strings for comparison
						const isLeft = String(leftId) === String(userId);
						const isRight = String(rightId) === String(userId);

						// console.log(`[Status] Checking match ${matchId}. Left: ${leftId}, Right: ${rightId}, User: ${userId}. Over: ${gameState.gameOver}`);

						if ((isLeft || isRight) && !gameState.gameOver) {
							// Determine opponent name
							const opponentName = isLeft
								? gameState.rightPlayer?.username
								: gameState.leftPlayer?.username;

							console.log(`[Status] Found active game for ${userId}: ${matchId}`);
							return reply.code(200).send({
								active: true,
								type: 'game',
								id: matchId, // legacy support
								matchId: matchId,
								opponent: opponentName || "Opponent",
								message: "You have an active remote game in progress."
							});
						}
					}
				}

				// 3. Fallback: Check Active Games (Legacy/Standalone GameManager)
				// For games created via create-game.js that are NOT in gameStates
				for (const [matchId, game] of gameManager.activeGames) {
					if (game.mode === 'remote') {
						const p1 = game.players.p1;
						const p2 = game.players.p2;

						const isP1 = p1.id && String(p1.id) === String(userId);
						const isP2 = p2.id && String(p2.id) === String(userId);

						// Check if game is playing
						if ((isP1 || isP2) && game.gameState.status === 'playing') {
							const opponent = isP1 ? p2 : p1;
							const opponentName = opponent.socket ? "Opponent" : "Waiting for Opponent";

							console.log(`[Status] Found active legacy game for ${userId}: ${matchId}`);
							return reply.code(200).send({
								active: true,
								type: 'game',
								id: matchId, // useful for redirection
								matchId: matchId,
								opponent: opponentName,
								message: "You have an active game in progress."
							});
						}
					}
				}

				return reply.send({ active: false });
			} catch (error) {
				console.error("Status check error:", error);
				return reply.code(500).send({ error: "Failed to check game status" });
			}
		}
	);
}
