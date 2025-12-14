// Game State Types
// "interface" means "struct" in C++ to holds data
export interface GameState {
	status: string;
	constant: {
		canvasWidth: number;
		canvasHeight: number;
		paddleWidth: number;
		paddleHeight: number;
		paddleSpeed: number;
		ballSize: number;
		FPS: number;
		TICK_MS: number;
		matchDuration: number;
	};
	timer: {
		timeRemaining: number;
		timeElapsed: number;
	};
	ball: {
		x: number;
		y: number;
		dx: number;
		dy: number;
	};
	paddles: {
		p1: {
			x: number;
			y: number;
			moving: string | null;
		};
		p2: {
			x: number;
			y: number;
			moving: string | null;
		};
	};
	score: {
		p1: number;
		p2: number;
	};
	winner: number | null;
	result?: "win" | "draw" | null;
	powerUps: PowerUp[];
	activeEffect: { type: PowerUpType; expiresAt: number } | null;
}

// "type" defines a list of specific option
// PowerUpType can be either the following options, other than these will be error
export type PowerUpType = 'SPEED_UP' | 'SPEED_DOWN' | 'SIZE_UP' | 'SIZE_DOWN';

export interface PowerUp {
	id: string;
	x: number;
	y: number;
	type: PowerUpType;
}

// Game Mode Types
export type GameMode = "local" | "remote";

// WebSocket Connection Type
export type WebSocketMode = "direct" | "context";

// Game Over Event
export interface GameOverEvent {
	type: "GAME_OVER";
	winner: number | null; // null for draw
	result: "win" | "draw";
	score: {
		p1: number;
		p2: number;
	};
}
