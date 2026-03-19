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
				const localMatchId =
					typeof request.query?.localMatchId === "string"
						? request.query.localMatchId
						: null;
				const localTournamentId =
					typeof request.query?.localTournamentId === "string"
						? request.query.localTournamentId
						: null;

				// 0. Check explicit local recovery candidates supplied by the frontend.
				// We only consider these when the browser still carries current-match state,
				// which prevents intentionally abandoned local games from resurfacing.
				if (localMatchId) {
					const localGame = gameManager.getGame(localMatchId);
					if (
						localGame &&
						localGame.mode === "local" &&
						localGame.gameState?.status !== "finished" &&
						String(localGame.players?.p1?.id) === String(userId)
					) {
						return reply.code(200).send({
							active: true,
							type: localGame.tournamentId ? "tournament" : "game",
							matchId: localMatchId,
							tournamentId: localGame.tournamentId || localTournamentId || undefined,
							opponent: "Local Opponent",
							message: localGame.tournamentId
								? "You have an active local tournament match."
								: "You have an active local match in progress.",
						});
					}
				}

				if (localTournamentId && !localMatchId) {
					const localTournament = activeTournaments.get(localTournamentId);
					if (
						localTournament &&
						!localTournament.isComplete() &&
						localTournament.players.some(
							(player) => String(player.id) === String(userId),
						)
					) {
						const activeLocalMatch = localTournament.matches.find(
							(match) =>
								match.status === "inprogress" &&
								(String(match.player1?.id) === String(userId) ||
									(match.player2 &&
										String(match.player2.id) === String(userId))),
						);
						const runtimeMatchId = activeLocalMatch
							? activeLocalMatch.matchId.startsWith("RT-")
								? activeLocalMatch.matchId
								: `local-${activeLocalMatch.matchId}`
							: null;

						return reply.code(200).send({
							active: true,
							type: "tournament",
							tournamentId: localTournamentId,
							matchId: runtimeMatchId || undefined,
							opponent: activeLocalMatch
								? String(activeLocalMatch.player1?.id) === String(userId)
									? activeLocalMatch.player2?.name || "Opponent"
									: activeLocalMatch.player1?.name || "Opponent"
								: "Tournament Lobby",
							message: activeLocalMatch
								? "You have an active local tournament match."
								: "You have an active local tournament in progress.",
						});
					}
				}

				// 1. Check Active Tournament Matches
				for (const [tournamentId, tournament] of activeTournaments) {
					// Check if user is in this tournament
					if (!tournament.players.some(p => String(p.id) === String(userId))) {
						continue;
					}

					// Withdrawn players should not receive reconnection prompts for this tournament.
					if (tournament.isPlayerWithdrawn && tournament.isPlayerWithdrawn(userId)) {
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
							if (gameState.tournamentId) {
								const tournament = activeTournaments.get(String(gameState.tournamentId));
								if (tournament?.isPlayerWithdrawn && tournament.isPlayerWithdrawn(userId)) {
									continue;
								}
							}

							// Determine opponent name
							const opponentName = isLeft
								? gameState.rightPlayer?.username
								: gameState.leftPlayer?.username;
							const gracePeriodEndsAt =
								gameState.paused && gameState.disconnectedPlayer && gameState.pausedAt
									? gameState.pausedAt + 30000
									: null;

							console.log(`[Status] Found active game for ${userId}: ${matchId}`);
							return reply.code(200).send({
								active: true,
								type: 'game',
								id: matchId, // legacy support
								matchId: matchId,
								opponent: opponentName || "Opponent",
								message: "You have an active remote game in progress.",
								gracePeriodEndsAt,
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
