// Tournament Types
export interface Player {
	id: string;
	name: string;
	isTemp?: boolean;
}

export interface TournamentMatch {
	matchId: string;
	tournamentId: string;
	round: number;
	player1: Player;
	player2: Player | null; // null for bye
	status: 'pending' | 'in-progress' | 'completed' | 'bye';
	result: {
		player1Id: string;
		player2Id: string | null;
		score: {
			p1: number;
			p2: number;
		};
		outcome: 'win' | 'draw' | 'bye';
	} | null;
}

export interface PlayerStanding {
	rank: number;
	playerId: string;
	playerName: string;
	isTemp: boolean;
	matchPoints: number;
	wins: number;
	draws: number;
	losses: number;
	scoreDifferential: number;
	totalPointsScored: number;
	byes: number;
	matchesPlayed: number;
}

export type TournamentFormat = 'round-robin' | 'swiss';

export interface Tournament {
	tournamentId: string;
	format: TournamentFormat;
	playerCount: number;
	currentRound: number;
	totalRounds: number;
	matches: TournamentMatch[];
	leaderboard: PlayerStanding[];
	isComplete: boolean;
}
