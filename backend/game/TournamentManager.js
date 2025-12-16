/**
 * Tournament Manager Class
 * Handles Round Robin and Swiss tournament formats
 * 
 * Formats:
 * - Round Robin (3-4 players): Everyone plays everyone once
 * - Swiss (5-8 players): 3 rounds, pair by match points, bye for odd players
 * 
 * Scoring:
 * - Win = 3 points
 * - Draw = 1 point
 * - Loss = 0 points
 * - Bye = 3 points (no score differential or total points)
 */

class TournamentManager {
	constructor(tournamentId, players) {
		this.tournamentId = tournamentId;
		this.players = players; // Array of {id, name, isTemp}
		this.format = this.determineFormat(players.length);
		this.matches = [];
		this.currentRound = 1;
		this.totalRounds = this.calculateTotalRounds();
		this.standings = this.initializeStandings();
	}

	/**
	 * Determine tournament format based on player count
	 */
	determineFormat(playerCount) {
		if (playerCount >= 3 && playerCount <= 4) {
			return 'round-robin';
		} else if (playerCount >= 5 && playerCount <= 8) {
			return 'swiss';
		} else {
			throw new Error('Invalid player count. Must be 3-8 players.');
		}
	}

	/**
	 * Calculate total rounds for tournament
	 */
	calculateTotalRounds() {
		if (this.format === 'round-robin') {
			// Everyone plays everyone once
			return this.players.length - 1;
		} else if (this.format === 'swiss') {
			// Always 3 rounds for Swiss
			return 3;
		}
	}

	/**
	 * Initialize player standings
	 */
	initializeStandings() {
		return this.players.map(player => ({
			playerId: player.id,
			playerName: player.name,
			isTemp: player.isTemp || false,
			matchPoints: 0,
			wins: 0,
			draws: 0,
			losses: 0,
			scoreDifferential: 0, // (self score - opponent score) across all matches
			totalPointsScored: 0,
			byes: 0,
			matchesPlayed: 0,
			opponents: [] // Track who they've played
		}));
	}

	/**
	 * Generate Round Robin pairings
	 * Returns all matches for the entire tournament
	 */
	generateRoundRobinPairings() {
		const matches = [];
		let matchId = 1;

		// Generate all possible pairings
		for (let i = 0; i < this.players.length; i++) {
			for (let j = i + 1; j < this.players.length; j++) {
				matches.push({
					matchId: `${this.tournamentId}-m${matchId}`,
					tournamentId: this.tournamentId,
					round: Math.ceil(matchId / (this.players.length / 2)), // Distribute across rounds
					player1: this.players[i],
					player2: this.players[j],
					status: 'pending', // pending, in-progress, completed
					result: null, // Will be: {winner, score: {p1, p2}, outcome: 'win'|'draw'}
				});
				matchId++;
			}
		}

		return matches;
	}

	/**
	 * Generate Swiss pairings for a specific round
	 */
	generateSwissPairings(roundNumber) {
		const matches = [];

		if (roundNumber === 1) {
			// Round 1: Random or seeded pairing
			return this.generateFirstRoundPairings();
		} else {
			// Rounds 2-3: Pair by match points
			return this.generateSubsequentRoundPairings(roundNumber);
		}
	}

	/**
	 * Generate first round Swiss pairings (random)
	 */
	generateFirstRoundPairings() {
		const matches = [];
		const shuffled = [...this.players].sort(() => Math.random() - 0.5);
		let matchId = 1;

		for (let i = 0; i < shuffled.length; i += 2) {
			if (i + 1 < shuffled.length) {
				// Normal pairing
				matches.push({
					matchId: `${this.tournamentId}-r1-m${matchId}`,
					tournamentId: this.tournamentId,
					round: 1,
					player1: shuffled[i],
					player2: shuffled[i + 1],
					status: 'pending',
					result: null,
				});
				matchId++;
			} else {
				// Odd player gets bye
				matches.push({
					matchId: `${this.tournamentId}-r1-bye`,
					tournamentId: this.tournamentId,
					round: 1,
					player1: shuffled[i],
					player2: null, // Bye
					status: 'bye',
					result: {
						winner: shuffled[i].id,
						outcome: 'bye',
						score: { p1: 0, p2: 0 }
					}
				});
			}
		}

		return matches;
	}

	/**
	 * Generate subsequent round pairings (by match points)
	 */
	generateSubsequentRoundPairings(roundNumber) {
		const matches = [];

		// Sort players by current standings (use consistent logic)
		const sorted = this.getLeaderboard();

		const paired = new Set();
		let matchId = 1;
		let byePlayer = null;

		// Find player who needs bye (if odd number)
		if (sorted.length % 2 !== 0) {
			// Give bye to lowest-ranked player who hasn't had one yet
			for (let i = sorted.length - 1; i >= 0; i--) {
				if (sorted[i].byes === 0) {
					byePlayer = sorted[i];
					paired.add(byePlayer.playerId);

					matches.push({
						matchId: `${this.tournamentId}-r${roundNumber}-bye`,
						tournamentId: this.tournamentId,
						round: roundNumber,
						player1: this.getPlayerById(byePlayer.playerId),
						player2: null,
						status: 'bye',
						result: {
							winner: byePlayer.playerId,
							outcome: 'bye',
							score: { p1: 0, p2: 0 }
						}
					});
					break;
				}
			}
		}

		// Pair remaining players
		for (let i = 0; i < sorted.length; i++) {
			if (paired.has(sorted[i].playerId)) continue;

			// Find best opponent
			for (let j = i + 1; j < sorted.length; j++) {
				if (paired.has(sorted[j].playerId)) continue;

				// Check if they haven't played before
				const hasPlayed = sorted[i].opponents.includes(sorted[j].playerId);

				if (!hasPlayed) {
					// Pair them
					const p1 = this.getPlayerById(sorted[i].playerId);
					const p2 = this.getPlayerById(sorted[j].playerId);

					matches.push({
						matchId: `${this.tournamentId}-r${roundNumber}-m${matchId}`,
						tournamentId: this.tournamentId,
						round: roundNumber,
						player1: p1,
						player2: p2,
						status: 'pending',
						result: null,
					});

					paired.add(sorted[i].playerId);
					paired.add(sorted[j].playerId);
					matchId++;
					break;
				}
			}
		}

		return matches;
	}

	/**
	 * Helper to get player by ID
	 */
	getPlayerById(playerId) {
		return this.players.find(p => p.id === playerId);
	}

	/**
	 * Update standings after a match completes
	 */
	updateStandings(matchResult) {
		const { player1Id, player2Id, score, outcome } = matchResult;

		const p1Standing = this.standings.find(s => s.playerId === player1Id);
		const p2Standing = player2Id ? this.standings.find(s => s.playerId === player2Id) : null;

		if (outcome === 'bye') {
			// Bye: 3 points, no score differential
			p1Standing.matchPoints += 3;
			p1Standing.byes += 1;
			return;
		}

		// Update match counts
		p1Standing.matchesPlayed += 1;
		if (p2Standing) p2Standing.matchesPlayed += 1;

		// Track opponents
		p1Standing.opponents.push(player2Id);
		if (p2Standing) p2Standing.opponents.push(player1Id);

		// Update scores
		p1Standing.totalPointsScored += score.p1;
		p1Standing.scoreDifferential += (score.p1 - score.p2);

		if (p2Standing) {
			p2Standing.totalPointsScored += score.p2;
			p2Standing.scoreDifferential += (score.p2 - score.p1);
		}

		// Update match points based on outcome
		if (outcome === 'draw') {
			p1Standing.matchPoints += 1;
			p1Standing.draws += 1;
			if (p2Standing) {
				p2Standing.matchPoints += 1;
				p2Standing.draws += 1;
			}
		} else if (outcome === 'win') {
			if (score.p1 > score.p2) {
				// Player 1 wins
				p1Standing.matchPoints += 3;
				p1Standing.wins += 1;
				if (p2Standing) p2Standing.losses += 1;
			} else {
				// Player 2 wins
				if (p2Standing) {
					p2Standing.matchPoints += 3;
					p2Standing.wins += 1;
				}
				p1Standing.losses += 1;
			}
		}
	}

	/**
	 * Get current leaderboard (sorted standings)
	 */
	getLeaderboard() {
		return [...this.standings].map(s => ({
			...s,
			avgScoreDifferential: s.matchesPlayed > 0 ? Number((s.scoreDifferential / s.matchesPlayed).toFixed(2)) : 0,
			avgTotalPointsScored: s.matchesPlayed > 0 ? Number((s.totalPointsScored / s.matchesPlayed).toFixed(2)) : 0
		})).sort((a, b) => {
			// Primary: Match points
			if (a.matchPoints !== b.matchPoints) {
				return b.matchPoints - a.matchPoints;
			}
			// Tie-breaker 1: Average Score differential
			if (a.avgScoreDifferential !== b.avgScoreDifferential) {
				return b.avgScoreDifferential - a.avgScoreDifferential;
			}
			// Tie-breaker 2: Average Total points scored
			return b.avgTotalPointsScored - a.avgTotalPointsScored;
		}).map((standing, index) => ({
			rank: index + 1,
			...standing
		}));
	}

	/**
	 * Check if tournament is complete
	 */
	isComplete() {
		if (this.format === 'round-robin') {
			// All matches must be completed
			return this.matches.every(m => m.status === 'completed');
		} else if (this.format === 'swiss') {
			// Must have completed all 3 rounds
			return this.currentRound > this.totalRounds;
		}
	}

	/**
	 * Get tournament summary
	 */
	getSummary() {
		return {
			tournamentId: this.tournamentId,
			format: this.format,
			playerCount: this.players.length,
			currentRound: this.currentRound,
			totalRounds: this.totalRounds,
			matches: this.matches,
			leaderboard: this.getLeaderboard(),
			isComplete: this.isComplete()
		};
	}
}

export default TournamentManager;
