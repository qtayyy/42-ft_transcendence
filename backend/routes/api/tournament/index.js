import TournamentManager from "../../../game/TournamentManager.js";

// Store active tournaments in memory
const activeTournaments = new Map();

export default async function (fastify, opts) {
	// Expose activeTournaments to fastify instance for other plugins (ws-game-matches)
	fastify.decorate("activeTournaments", activeTournaments);

	/**
	 * Create a new tournament
	 * POST /api/tournament/create
	 */
	fastify.post(
		"/create",
		{
			onRequest: [fastify.authenticate],
		},
		async (request, reply) => {
			try {
				const { players, tournamentId: customTournamentId } = request.body; // Array of {id, name, isTemp}

				if (!players || players.length < 3 || players.length > 8) {
					return reply.code(400).send({
						error: "Tournament must have 3-8 players"
					});
				}

				// Use custom tournamentId if provided, otherwise generate one
				const tournamentId = customTournamentId || `tournament-${Date.now()}`;

				// Check if tournament already exists
				if (activeTournaments.has(tournamentId)) {
					// Return existing tournament data
					const existingTournament = activeTournaments.get(tournamentId);
					return reply.code(200).send({
						success: true,
						tournamentId: tournamentId,
						format: existingTournament.format,
						totalRounds: existingTournament.totalRounds,
						matches: existingTournament.matches,
						leaderboard: existingTournament.getLeaderboard(),
						currentRound: existingTournament.currentRound
					});
				}

				// Create tournament manager
				const tournament = new TournamentManager(tournamentId, players);

				// Generate initial matches based on format
				if (tournament.format === 'round-robin') {
					tournament.matches = tournament.generateRoundRobinPairings();
				} else if (tournament.format === 'swiss') {
					tournament.matches = tournament.generateSwissPairings(1);
				}

				// Store tournament
				activeTournaments.set(tournamentId, tournament);

				return reply.code(200).send({
					success: true,
					tournamentId: tournamentId,
					format: tournament.format,
					totalRounds: tournament.totalRounds,
					matches: tournament.matches,
					leaderboard: tournament.getLeaderboard()
				});

			} catch (error) {
				console.error("Error creating tournament:", error);
				return reply.code(500).send({ error: "Failed to create tournament" });
			}
		}
	);

	/**
	 * Get tournament status
	 * GET /api/tournament/:id
	 */
	fastify.get(
		"/:id",
		{
			onRequest: [fastify.authenticate],
		},
		async (request, reply) => {
			try {
				const { id } = request.params;
				const tournament = activeTournaments.get(id);

				if (!tournament) {
					return reply.code(404).send({ error: "Tournament not found" });
				}

				return reply.code(200).send(tournament.getSummary());

			} catch (error) {
				console.error("Error fetching tournament:", error);
				return reply.code(500).send({ error: "Failed to fetch tournament" });
			}
		}
	);

	/**
	 * Update match result and standings
	 * POST /api/tournament/:id/match-result
	 */
	fastify.post(
		"/:id/match-result",
		{
			onRequest: [fastify.authenticate],
		},
		async (request, reply) => {
			try {
				const { id } = request.params;
				const { matchId, player1Id, player2Id, score, outcome } = request.body;

				const tournament = activeTournaments.get(id);

				if (!tournament) {
					return reply.code(404).send({ error: "Tournament not found" });
				}

				// Find and update the match
				const match = tournament.matches.find(m => m.matchId === matchId);
				if (!match) {
					return reply.code(404).send({ error: "Match not found" });
				}

				// Update match status
				match.status = 'completed';
				match.result = { player1Id, player2Id, score, outcome };

				// Update standings
				tournament.updateStandings({ player1Id, player2Id, score, outcome });

				// Check if we need to generate next round (Swiss only)
				if (tournament.format === 'swiss') {
					const roundMatches = tournament.matches.filter(m => m.round === tournament.currentRound);
					const allRoundComplete = roundMatches.every(m => m.status === 'completed' || m.status === 'bye');

					if (allRoundComplete && tournament.currentRound < tournament.totalRounds) {
						// Generate next round
						tournament.currentRound += 1;
						const nextRoundMatches = tournament.generateSwissPairings(tournament.currentRound);
						tournament.matches.push(...nextRoundMatches);
					}
				}

				return reply.code(200).send({
					success: true,
					leaderboard: tournament.getLeaderboard(),
					isComplete: tournament.isComplete(),
					currentRound: tournament.currentRound,
					nextMatches: tournament.matches.filter(m => m.status === 'pending')
				});

			} catch (error) {
				console.error("Error updating match result:", error);
				return reply.code(500).send({ error: "Failed to update match result" });
			}
		}
	);

	/**
	 * Get current leaderboard
	 * GET /api/tournament/:id/leaderboard
	 */
	fastify.get(
		"/:id/leaderboard",
		{
			onRequest: [fastify.authenticate],
		},
		async (request, reply) => {
			try {
				const { id } = request.params;
				const tournament = activeTournaments.get(id);

				if (!tournament) {
					return reply.code(404).send({ error: "Tournament not found" });
				}

				return reply.code(200).send({
					leaderboard: tournament.getLeaderboard(),
					format: tournament.format,
					currentRound: tournament.currentRound,
					totalRounds: tournament.totalRounds
				});

			} catch (error) {
				console.error("Error fetching leaderboard:", error);
				return reply.code(500).send({ error: "Failed to fetch leaderboard" });
			}
		}
	);

	/**
	 * Get next match to play
	 * GET /api/tournament/:id/next-match
	 */
	fastify.get(
		"/:id/next-match",
		{
			onRequest: [fastify.authenticate],
		},
		async (request, reply) => {
			try {
				const { id } = request.params;
				const tournament = activeTournaments.get(id);

				if (!tournament) {
					return reply.code(404).send({ error: "Tournament not found" });
				}

				// Find first pending match
				const nextMatch = tournament.matches.find(m => m.status === 'pending');

				if (!nextMatch) {
					return reply.code(200).send({
						nextMatch: null,
						message: tournament.isComplete() ? "Tournament complete" : "No pending matches"
					});
				}

				return reply.code(200).send({
					nextMatch: nextMatch
				});

			} catch (error) {
				console.error("Error fetching next match:", error);
				return reply.code(500).send({ error: "Failed to fetch next match" });
			}
		}
	);
}
