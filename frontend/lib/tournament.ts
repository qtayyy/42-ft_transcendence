// Tournament Types
export interface Player {
	id: string;
	name: string;
}

export interface Match {
	id: string;
	round: number;
	matchNumber: number;
	player1: Player | null;
	player2: Player | null;
	winner: Player | null;
	score: {
		player1: number;
		player2: number;
	} | null;
	status: "pending" | "ready" | "in-progress" | "completed";
}

export interface Tournament {
	id: string;
	players: Player[];
	matches: Match[];
	currentMatch: string | null;
	winner: Player | null;
	status: "setup" | "in-progress" | "completed";
}

// Generate tournament bracket from players
export function generateBracket(players: Player[]): Match[] {
	const playerCount = players.length;
	const rounds = Math.log2(playerCount);

	if (!Number.isInteger(rounds)) {
		throw new Error("Player count must be a power of 2 (4, 8, 16, etc.)");
	}

	const matches: Match[] = [];
	let matchId = 1;

	// Generate first round matches
	const firstRoundMatches = playerCount / 2;
	for (let i = 0; i < firstRoundMatches; i++) {
		matches.push({
			id: `match-${matchId}`,
			round: 1,
			matchNumber: i + 1,
			player1: players[i * 2],
			player2: players[i * 2 + 1],
			winner: null,
			score: null,
			status: "ready",
		});
		matchId++;
	}

	// Generate subsequent round matches (empty, to be filled by winners)
	for (let round = 2; round <= rounds; round++) {
		const matchesInRound = Math.pow(2, rounds - round);
		for (let i = 0; i < matchesInRound; i++) {
			matches.push({
				id: `match-${matchId}`,
				round: round,
				matchNumber: i + 1,
				player1: null,
				player2: null,
				winner: null,
				score: null,
				status: "pending",
			});
			matchId++;
		}
	}

	return matches;
}

// Shuffle players randomly
export function shufflePlayers(players: Player[]): Player[] {
	const shuffled = [...players];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
}

// Update bracket with match result
export function updateBracketWithResult(
	matches: Match[],
	matchId: string,
	winner: Player,
	score: { player1: number; player2: number }
): Match[] {
	const updatedMatches = [...matches];
	const matchIndex = updatedMatches.findIndex((m) => m.id === matchId);

	if (matchIndex === -1) return updatedMatches;

	const match = updatedMatches[matchIndex];
	match.winner = winner;
	match.score = score;
	match.status = "completed";

	// Find next match in the bracket
	const currentRound = match.round;
	const currentMatchNumber = match.matchNumber;

	// Calculate which match in the next round this winner advances to
	const nextRoundMatchNumber = Math.ceil(currentMatchNumber / 2);
	const nextMatch = updatedMatches.find(
		(m) => m.round === currentRound + 1 && m.matchNumber === nextRoundMatchNumber
	);

	if (nextMatch) {
		// Determine if this is player1 or player2 in next match
		if (currentMatchNumber % 2 === 1) {
			nextMatch.player1 = winner;
		} else {
			nextMatch.player2 = winner;
		}

		// Update status of next match
		if (nextMatch.player1 && nextMatch.player2) {
			nextMatch.status = "ready";
		}
	}

	return updatedMatches;
}

// Get the current match to play
export function getCurrentMatch(matches: Match[]): Match | null {
	// Find the first ready match (has both players, not yet completed)
	const readyMatch = matches.find(
		(m) => m.status === "ready" || m.status === "in-progress"
	);
	return readyMatch || null;
}

// Check if tournament is complete
export function isTournamentComplete(matches: Match[]): boolean {
	const finalMatch = matches[matches.length - 1];
	return finalMatch.status === "completed";
}

// Get tournament winner
export function getTournamentWinner(matches: Match[]): Player | null {
	const finalMatch = matches[matches.length - 1];
	return finalMatch.winner;
}

// Get matches by round
export function getMatchesByRound(matches: Match[]): Map<number, Match[]> {
	const matchesByRound = new Map<number, Match[]>();

	matches.forEach((match) => {
		const roundMatches = matchesByRound.get(match.round) || [];
		roundMatches.push(match);
		matchesByRound.set(match.round, roundMatches);
	});

	return matchesByRound;
}
