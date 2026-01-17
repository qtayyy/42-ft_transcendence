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

// Shared storage for active tournaments
export const activeTournaments = new Map();

class TournamentManager {
	constructor(tournamentId, players) {
		this.tournamentId = tournamentId;
		this.players = players; // Array of {id, name, isTemp}
		this.format = this.determineFormat(players.length);
		this.matches = [];
		this.currentRound = 1;
		this.totalRounds = this.calculateTotalRounds();
		this.standings = this.initializeStandings();
		this.createdAt = Date.now();
		this.completedAt = null;
		this.playerReadyStates = new Map(); // Track which players are ready for their next match
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
			// Everyone must play everyone once
			// With bye handling, this is always (padded player count) - 1
			const paddedCount = this.players.length % 2 === 0 ? this.players.length : this.players.length + 1;
			return paddedCount - 1;
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

		// Clone players array
		let roundPlayers = [...this.players];

		// If odd number of players, add a dummy player for Byes
		// The dummy is represented as null inside the algorithm
		if (roundPlayers.length % 2 !== 0) {
			roundPlayers.push(null);
		}

		const numPlayers = roundPlayers.length;
		const numRounds = numPlayers - 1;
		const half = numPlayers / 2;

		// Generate pairings for each round
		for (let round = 1; round <= numRounds; round++) {
			for (let i = 0; i < half; i++) {
				const p1 = roundPlayers[i];
				const p2 = roundPlayers[numPlayers - 1 - i];

				// If one player is the dummy, the other gets a Bye
				if (p1 === null || p2 === null) {
					const actualPlayer = p1 || p2;
					// Create a Bye Match
					matches.push({
						matchId: `${this.tournamentId}-r${round}-bye`,
						tournamentId: this.tournamentId,
						round: round,
						player1: actualPlayer,
						player2: null,
						status: 'pending', // Pending so user can "Confirm" it
						result: null,
					});
				} else {
					// Normal Match
					matches.push({
						matchId: `${this.tournamentId}-m${matchId}`,
						tournamentId: this.tournamentId,
						round: round,
						player1: p1,
						player2: p2,
						status: 'pending',
						result: null,
					});
					matchId++;
				}
			}

			// Rotate players for next round (Circle Method)
			// Keep the first player fixed, rotate the rest clockwise
			// [0, 1, 2, 3] -> [0, 3, 1, 2] -> [0, 2, 3, 1]
			roundPlayers.splice(1, 0, roundPlayers.pop());
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
					p1Ready: false,
					p2Ready: false,
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
					status: 'pending', // Pending until processed at end of round
					p1Ready: true, // Bye is always ready
					p2Ready: true,
					result: null // Will be set by checkAndProcessRoundBye
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
						status: 'pending', // Pending until processed at end of round
						p1Ready: true,
						p2Ready: true,
						result: null // Will be set by checkAndProcessRoundBye
					});
					break;
				}
			}
		}

		// Pair remaining players
		for (let i = 0; i < sorted.length; i++) {
			if (paired.has(sorted[i].playerId)) continue;

			let opponentIndex = -1;

			// Try to find opponent who hasn't played
			for (let j = i + 1; j < sorted.length; j++) {
				if (paired.has(sorted[j].playerId)) continue;
				if (!sorted[i].opponents.includes(sorted[j].playerId)) {
					opponentIndex = j;
					break;
				}
			}

			// Fallback: Pair with next available player (rematch)
			if (opponentIndex === -1) {
				for (let j = i + 1; j < sorted.length; j++) {
					if (paired.has(sorted[j].playerId)) continue;
					opponentIndex = j;
					break;
				}
			}

			if (opponentIndex !== -1) {
				// Pair them
				const p1 = this.getPlayerById(sorted[i].playerId);
				const p2 = this.getPlayerById(sorted[opponentIndex].playerId);

				matches.push({
					matchId: `${this.tournamentId}-r${roundNumber}-m${matchId}`,
					tournamentId: this.tournamentId,
					round: roundNumber,
					player1: p1,
					player2: p2,
					status: 'pending',
					p1Ready: false,
					p2Ready: false,
					result: null,
				});

				paired.add(sorted[i].playerId);
				paired.add(sorted[opponentIndex].playerId);
				matchId++;
			}
		}

		return matches;
	}

	setLobbyReady(matchId, userId) {
		const match = this.matches.find(m => m.matchId === matchId);
		if (!match) return { success: false };

		// Ensure userId is number for comparison
		const uid = Number(userId);

		if (Number(match.player1.id) === uid) match.p1Ready = true;
		else if (match.player2 && Number(match.player2.id) === uid) match.p2Ready = true;

		// Check if both are ready (or if bye)
		const allReady = match.p1Ready && (match.player2 ? match.p2Ready : true);

		return { success: true, match, allReady };
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

		if (outcome === 'forfeit') {
			// Determine winner (the one who didn't forfeit)
			// Let's deduce winner/loser based on score (5-0)
			const winnerId = score.p1 > score.p2 ? player1Id : player2Id;
			const loserId = score.p1 > score.p2 ? player2Id : player1Id;

			const winnerStanding = this.standings.find(s => s.playerId === winnerId);
			const loserStanding = this.standings.find(s => s.playerId === loserId);

			if (winnerStanding) {
				winnerStanding.matchPoints += 3;
				winnerStanding.wins += 1;
				winnerStanding.matchesPlayed += 1;
				winnerStanding.totalPointsScored += (score.p1 > score.p2 ? score.p1 : score.p2);
				winnerStanding.scoreDifferential += Math.abs(score.p1 - score.p2);
				winnerStanding.opponents.push(loserId);
			}
			if (loserStanding) {
				loserStanding.losses += 1;
				loserStanding.matchesPlayed += 1;
				loserStanding.totalPointsScored += (score.p1 > score.p2 ? score.p2 : score.p1);
				loserStanding.scoreDifferential -= Math.abs(score.p1 - score.p2);
				loserStanding.opponents.push(winnerId);
			}
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
	 * Mark match as in progress
	 */
	markMatchInProgress(matchId) {
		const match = this.matches.find(m => m.matchId === matchId);
		if (!match) return false;

		if (match.status === 'pending') {
			match.status = 'inprogress';
			return true;
		}
		return false;
	}

	/**
	 * Update match result
	 */
	updateMatchResult(matchId, score, outcome) {
		const match = this.matches.find(m => m.matchId === matchId);
		if (!match) {
			console.error(`Tournament match not found: ${matchId}`);
			return { success: false };
		}

		// Prevent double updates
		if (match.status === 'completed') return { success: true };

		match.status = 'completed';
		match.result = {
			winner: outcome === 'win' ? (score.p1 > score.p2 ? match.player1.id : match.player2.id) : null,
			outcome,
			score
		};

		// Update standings
		this.updateStandings({
			player1Id: match.player1.id,
			player2Id: match.player2 ? match.player2.id : null,
			score,
			outcome
		});

		console.log(`Tournament ${this.tournamentId}: Match ${matchId} completed.`);

		// Check if all *other* matches in this round are complete
		// If so, and there's a pending Bye match, auto-complete it
		const byeResult = this.checkAndProcessRoundBye(match.round);

		return {
			success: true,
			roundChanged: byeResult.roundChanged,
			tournamentId: this.tournamentId
		};
	}

	/**
	 * Check if round is effectively complete (only bye remaining)
	 * and process the bye if so.
	 */
	checkAndProcessRoundBye(round) {
		let roundChanged = false;
		const roundMatches = this.matches.filter(m => m.round === round);

		// Get all "real" matches (non-bye)
		const realMatches = roundMatches.filter(m => m.player2 !== null);
		const allRealMatchesComplete = realMatches.every(m => m.status === 'completed');

		if (allRealMatchesComplete) {
			// Find pending bye match
			const byeMatch = roundMatches.find(m => m.player2 === null && m.status === 'pending');

			if (byeMatch) {
				console.log(`Tournament ${this.tournamentId}: All matches in round ${round} complete. Auto-processing bye for ${byeMatch.player1.name}`);
				this.updateMatchResult(byeMatch.matchId, { p1: 0, p2: 0 }, 'bye');
			}
		}

		// Check if round is fully complete (all matches including byes)
		const roundComplete = this.matches
			.filter(m => m.round === round)
			.every(m => m.status === 'completed');

		if (roundComplete && round === this.currentRound) {
			this.currentRound++;
			roundChanged = true;
			console.log(`Tournament ${this.tournamentId}: Round ${round} complete. Advancing to Round ${this.currentRound}`);

			// If tournament is now complete (currentRound > totalRounds), seal it
			if (this.currentRound > this.totalRounds) {
				console.log(`Tournament ${this.tournamentId}: All rounds complete. Tournament finished.`);
				this.completedAt = Date.now();
			}
			// Otherwise generate next round pairings (Swiss only)
			else if (this.format === 'swiss') {
				// Safety check: ensure we haven't already generated matches for this round
				const existingMatches = this.matches.filter(m => m.round === this.currentRound);
				if (existingMatches.length > 0) {
					console.log(`Tournament ${this.tournamentId}: Matches for Round ${this.currentRound} already exist. Skipping generation.`);
				} else {
					try {
						console.log(`Tournament ${this.tournamentId}: Generating Swiss pairings for Round ${this.currentRound}`);
						const newMatches = this.generateSwissPairings(this.currentRound);
						this.matches.push(...newMatches);
					} catch (err) {
						console.error(`Tournament ${this.tournamentId}: Failed to generate Swiss pairings:`, err);
					}
				}
			}
		}

		return { roundChanged };
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
