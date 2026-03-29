import type { GameState } from "@/types/game";
import type { GameStateValue } from "@/types/types";

export const LOCAL_TOURNAMENT_PENDING_RESULT_PREFIX =
	"pending-local-tournament-result:";

export type MovementDirection = "UP" | "DOWN";

export interface DisconnectInfo {
	disconnectedPlayer: string;
	gracePeriodEndsAt: number;
	countdown: number;
}

export interface PauseInfo {
	pausedBy: string;
	pausedByName: string;
	myReadyToResume: boolean;
	opponentReadyToResume: boolean;
}

export interface LocalMatchData {
	matchId?: number | string;
	tournamentId?: number | string | null;
	isTournamentMatch?: boolean;
	player1?: { id?: number | string | null } | null;
	player2?: { id?: number | string | null } | null;
}

export interface RuntimeGameOverResult {
	matchId?: number | string;
	tournamentId?: number | string | null;
	winner?: string | null;
	leftPlayer?: {
		id?: number | string;
		username?: string;
		score?: number;
	};
	rightPlayer?: {
		id?: number | string;
		username?: string;
		score?: number;
	};
}

interface RemoteRuntimeDefaults {
	canvasWidth: number;
	canvasHeight: number;
	paddleWidth: number;
	paddleHeight: number;
	ballSize: number;
	matchDuration: number;
	paddleSpeed: number;
	fps: number;
}

const REMOTE_RUNTIME_DEFAULTS: RemoteRuntimeDefaults = {
	canvasWidth: 800,
	canvasHeight: 350,
	paddleWidth: 12,
	paddleHeight: 80,
	ballSize: 12,
	matchDuration: 120000,
	paddleSpeed: 10,
	fps: 60,
};

type RemoteGameStateWithDisconnect = GameStateValue & {
	disconnectedPlayer?: string;
};

function hasHeldDirection(
	heldKeys: Set<string>,
	targetDirection: MovementDirection
) {
	for (const key of heldKeys) {
		if (getMovementDirectionForKey(key) === targetDirection) {
			return true;
		}
	}

	return false;
}

function getRemoteCurrentPlayerSide(
	gameState: GameStateValue,
	userId?: string | number | null
) {
	if (gameState.me === "LEFT" || gameState.me === "RIGHT") {
		return gameState.me;
	}

	return String(gameState.leftPlayer?.id) === String(userId) ? "LEFT" : "RIGHT";
}

function getRemoteWinner(result: RuntimeGameOverResult | null) {
	const winnerToken = String(result?.winner || "").toUpperCase();

	if (winnerToken === "LEFT") return 1;
	if (winnerToken === "RIGHT") return 2;
	return null;
}

export function getMovementDirectionForKey(
	key: string
): MovementDirection | null {
	if (key === "w" || key === "W" || key === "ArrowUp") return "UP";
	if (key === "s" || key === "S" || key === "ArrowDown") return "DOWN";
	return null;
}

export function getNextHeldDirection(
	heldKeys: Set<string>,
	currentDirection: MovementDirection | null
): MovementDirection | null {
	const hasUp = hasHeldDirection(heldKeys, "UP");
	const hasDown = hasHeldDirection(heldKeys, "DOWN");

	if (currentDirection === "UP" && hasUp) return "UP";
	if (currentDirection === "DOWN" && hasDown) return "DOWN";
	if (hasUp) return "UP";
	if (hasDown) return "DOWN";
	return null;
}

export function getDisconnectInfoFromRemoteState(
	gameState: GameStateValue
): DisconnectInfo | null {
	const gameStateWithDisconnect = gameState as RemoteGameStateWithDisconnect;
	const disconnectCountdown = gameState.disconnectCountdown;

	if (disconnectCountdown?.gracePeriodEndsAt) {
		const countdown = Math.ceil(
			(disconnectCountdown.gracePeriodEndsAt - Date.now()) / 1000
		);

		if (countdown > 0) {
			return {
				disconnectedPlayer:
					disconnectCountdown.disconnectedPlayer ||
					gameStateWithDisconnect.disconnectedPlayer ||
					"",
				gracePeriodEndsAt: disconnectCountdown.gracePeriodEndsAt,
				countdown,
			};
		}
	}

	if (
		gameState.paused &&
		gameStateWithDisconnect.disconnectedPlayer &&
		gameState.pausedAt
	) {
		const gracePeriodEndsAt = gameState.pausedAt + 30000;
		const countdown = Math.ceil((gracePeriodEndsAt - Date.now()) / 1000);

		if (countdown > 0) {
			return {
				disconnectedPlayer: gameStateWithDisconnect.disconnectedPlayer,
				gracePeriodEndsAt,
				countdown,
			};
		}
	}

	return null;
}

export function hasSameDisconnectInfo(
	left: DisconnectInfo | null,
	right: DisconnectInfo | null
) {
	if (!left && !right) return true;
	if (!left || !right) return false;

	return (
		left.disconnectedPlayer === right.disconnectedPlayer &&
		left.gracePeriodEndsAt === right.gracePeriodEndsAt
	);
}

export function getPauseInfoFromRemoteState(
	gameState: GameStateValue,
	userId?: string | number | null
): PauseInfo | null {
	if (!gameState.paused) return null;

	const currentPlayerSide = getRemoteCurrentPlayerSide(gameState, userId);
	const myReadyToResume =
		gameState.resumeReady?.[currentPlayerSide as "LEFT" | "RIGHT"] || false;
	const opponentSide = currentPlayerSide === "LEFT" ? "RIGHT" : "LEFT";
	const opponentReadyToResume =
		gameState.resumeReady?.[opponentSide as "LEFT" | "RIGHT"] || false;
	const pausedBy = gameState.pausedBy || "";
	const pausedByName =
		gameState.pausedByName ||
		(gameState.pausedBy === "LEFT"
			? gameState.leftPlayer?.username
			: gameState.rightPlayer?.username) ||
		"Unknown";

	return {
		pausedBy,
		pausedByName,
		myReadyToResume,
		opponentReadyToResume,
	};
}

export function shouldAllowTournamentNavigation({
	href,
	isRemoteGame,
	isTournamentMatch,
	tournamentId,
}: {
	href: string;
	isRemoteGame: boolean;
	isTournamentMatch: boolean;
	tournamentId?: string | number | null;
}) {
	if (!(isRemoteGame && isTournamentMatch)) {
		return false;
	}

	const tournamentLobbyPath = tournamentId
		? `/game/remote/tournament/${tournamentId}`
		: null;

	return (
		(tournamentLobbyPath && href.includes(tournamentLobbyPath)) ||
		href.includes("/game/")
	);
}

export function normalizeRemoteGameState(
	gameState: GameStateValue,
	gameOverResult: RuntimeGameOverResult | null
): GameState | null {
	const leftPlayer = gameState.leftPlayer;
	const rightPlayer = gameState.rightPlayer;
	const ball = gameState.ball;

	if (!leftPlayer || !rightPlayer || !ball) {
		return null;
	}

	const constants = {
		canvasWidth:
			gameState.constant?.canvasWidth || REMOTE_RUNTIME_DEFAULTS.canvasWidth,
		canvasHeight:
			gameState.constant?.canvasHeight || REMOTE_RUNTIME_DEFAULTS.canvasHeight,
		paddleWidth:
			gameState.constant?.paddleWidth || REMOTE_RUNTIME_DEFAULTS.paddleWidth,
		paddleHeight:
			gameState.constant?.paddleHeight || REMOTE_RUNTIME_DEFAULTS.paddleHeight,
		paddleSpeed:
			gameState.constant?.paddleSpeed || REMOTE_RUNTIME_DEFAULTS.paddleSpeed,
		ballSize: gameState.constant?.ballSize || REMOTE_RUNTIME_DEFAULTS.ballSize,
		matchDuration:
			gameState.constant?.matchDuration || REMOTE_RUNTIME_DEFAULTS.matchDuration,
	};
	const winner = getRemoteWinner(gameOverResult);
	const result = winner ? "win" : gameOverResult ? "draw" : null;

	return {
		status: gameOverResult
			? "finished"
			: gameState.paused
				? "paused"
				: gameState.gameStarted
					? "playing"
					: "waiting",
		constant: {
			canvasWidth: constants.canvasWidth,
			canvasHeight: constants.canvasHeight,
			paddleWidth: constants.paddleWidth,
			paddleHeight: constants.paddleHeight,
			paddleSpeed: constants.paddleSpeed,
			ballSize: constants.ballSize,
			FPS: REMOTE_RUNTIME_DEFAULTS.fps,
			TICK_MS: 1000 / REMOTE_RUNTIME_DEFAULTS.fps,
			matchDuration: constants.matchDuration,
		},
		timer: gameState.timer || {
			timeElapsed: 0,
			timeRemaining: constants.matchDuration,
		},
		ball: {
			x: ball.posX || 0,
			y: ball.posY || 0,
			dx: ball.dx || 0,
			dy: ball.dy || 0,
		},
		paddles: {
			p1: {
				x: leftPlayer.paddleX || 0,
				y: leftPlayer.paddleY || 0,
				moving: leftPlayer.moving || null,
			},
			p2: {
				x:
					rightPlayer.paddleX ??
					(constants.canvasWidth - constants.paddleWidth),
				y: rightPlayer.paddleY || 0,
				moving: rightPlayer.moving || null,
			},
		},
		score: {
			p1: leftPlayer.score || 0,
			p2: rightPlayer.score || 0,
		},
		winner,
		result,
		powerUps: gameState.powerUps || [],
		activeEffect: gameState.activeEffect || null,
	};
}
