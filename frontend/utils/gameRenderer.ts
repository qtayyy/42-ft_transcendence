import { GameState } from "@/types/game";
import { getEffectColor, getPowerUpColor, getPowerUpSymbol } from "./gameHelpers";

interface CanvasDimensions {
	width: number;
	height: number;
}

interface Scale {
	x: number;
	y: number;
}

export type BackgroundId = 'default' | 'neon' | 'retro' | 'space';

export interface BackgroundOption {
	id: BackgroundId;
	name: string;
	unlockKey: string | null;
	description: string;
}

export const BACKGROUND_OPTIONS: BackgroundOption[] = [
	{ id: 'default', name: 'Classic',    unlockKey: null,             description: 'Original black court' },
	{ id: 'neon',    name: 'Neon Grid',  unlockKey: 'TOTAL_WINS_10',  description: 'Cyberpunk neon grid — 10 wins' },
	{ id: 'retro',   name: 'Retro CRT',  unlockKey: 'LEVEL_5',        description: 'Vintage CRT scanlines — Level 5' },
	{ id: 'space',   name: 'Deep Space', unlockKey: 'TOURNAMENT_WIN', description: 'Starfield — Win a tournament' },
];

function drawDefaultBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
	ctx.fillStyle = "#000000";
	ctx.fillRect(0, 0, w, h);
}

function drawNeonBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
	ctx.fillStyle = '#0a0a1a';
	ctx.fillRect(0, 0, w, h);

	// Grid
	const gridSize = 40;
	ctx.lineWidth = 1;
	ctx.strokeStyle = 'rgba(0, 255, 255, 0.07)';
	ctx.setLineDash([]);
	for (let x = 0; x <= w; x += gridSize) {
		ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
	}
	for (let y = 0; y <= h; y += gridSize) {
		ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
	}

	// Edge glow lines
	const grad = ctx.createLinearGradient(0, 0, w, 0);
	grad.addColorStop(0,   'rgba(0, 255, 255, 0.4)');
	grad.addColorStop(0.5, 'rgba(200, 0, 255, 0.2)');
	grad.addColorStop(1,   'rgba(0, 255, 255, 0.4)');
	ctx.strokeStyle = grad;
	ctx.lineWidth = 2;
	ctx.beginPath(); ctx.moveTo(0, 1);   ctx.lineTo(w, 1);   ctx.stroke();
	ctx.beginPath(); ctx.moveTo(0, h-1); ctx.lineTo(w, h-1); ctx.stroke();
}

function drawRetroBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
	ctx.fillStyle = '#050f05';
	ctx.fillRect(0, 0, w, h);

	// Scanlines
	for (let y = 0; y < h; y += 4) {
		ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
		ctx.fillRect(0, y, w, 2);
	}

	// Subtle green vignette
	const vignette = ctx.createRadialGradient(w / 2, h / 2, h * 0.1, w / 2, h / 2, h * 0.9);
	vignette.addColorStop(0, 'rgba(0, 180, 0, 0.04)');
	vignette.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
	ctx.fillStyle = vignette;
	ctx.fillRect(0, 0, w, h);
}

function drawSpaceBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
	ctx.fillStyle = '#000005';
	ctx.fillRect(0, 0, w, h);

	// Deterministic stars
	for (let i = 0; i < 130; i++) {
		const x = Math.abs(Math.sin(i * 127.1 + 3.3) * 9999) % w;
		const y = Math.abs(Math.sin(i * 311.7 + 1.1) * 9999) % h;
		const r = Math.abs(Math.sin(i * 51.3)) * 1.2 + 0.3;
		const a = Math.abs(Math.sin(i * 91.7)) * 0.6 + 0.4;
		ctx.beginPath();
		ctx.arc(x, y, r, 0, Math.PI * 2);
		ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
		ctx.fill();
		ctx.closePath();
	}

	// Nebula
	const nebula = ctx.createRadialGradient(w * 0.72, h * 0.28, 0, w * 0.72, h * 0.28, h * 0.7);
	nebula.addColorStop(0, 'rgba(80, 0, 140, 0.1)');
	nebula.addColorStop(1, 'rgba(0, 0, 0, 0)');
	ctx.fillStyle = nebula;
	ctx.fillRect(0, 0, w, h);
}

function getCenterLineColor(background: BackgroundId): string {
	switch (background) {
		case 'neon':   return 'rgba(0, 255, 255, 0.25)';
		case 'retro':  return 'rgba(0, 200, 0, 0.3)';
		case 'space':  return 'rgba(150, 150, 255, 0.2)';
		default:       return 'rgba(255, 255, 255, 0.3)';
	}
}

function lerp(start: number, end: number, alpha: number) {
	return start + (end - start) * alpha;
}

function getScale(gameState: GameState, canvasDimensions: CanvasDimensions): Scale {
	return {
		x: canvasDimensions.width / gameState.constant.canvasWidth,
		y: canvasDimensions.height / gameState.constant.canvasHeight,
	};
}

function drawPitch(
	context: CanvasRenderingContext2D,
	canvasDimensions: CanvasDimensions,
	scale: Scale,
	background: BackgroundId
) {
	switch (background) {
		case 'neon':   drawNeonBackground(context, canvasDimensions.width, canvasDimensions.height); break;
		case 'retro':  drawRetroBackground(context, canvasDimensions.width, canvasDimensions.height); break;
		case 'space':  drawSpaceBackground(context, canvasDimensions.width, canvasDimensions.height); break;
		default:       drawDefaultBackground(context, canvasDimensions.width, canvasDimensions.height); break;
	}

	context.setLineDash([10 * scale.x, 10 * scale.x]);
	context.beginPath();
	context.moveTo(canvasDimensions.width / 2, 0);
	context.lineTo(canvasDimensions.width / 2, canvasDimensions.height);
	context.strokeStyle = getCenterLineColor(background);
	context.lineWidth = 2;
	context.stroke();
	context.setLineDash([]);
}

function drawPaddles(
	context: CanvasRenderingContext2D,
	gameState: GameState,
	canvasDimensions: CanvasDimensions,
	scale: Scale
) {
	const paddleWidth = gameState.constant.paddleWidth * scale.x;
	const paddleHeight = gameState.constant.paddleHeight * scale.y;
	const leftPaddleX = gameState.paddles.p1.x * scale.x;
	const leftPaddleY = gameState.paddles.p1.y * scale.y;
	const rightPaddleX = gameState.paddles.p2.x * scale.x;
	const rightPaddleY = gameState.paddles.p2.y * scale.y;
	const clampedRightPaddleX = Math.min(
		rightPaddleX,
		canvasDimensions.width - paddleWidth
	);

	context.fillStyle = "#FFFFFF";
	context.fillRect(leftPaddleX, leftPaddleY, paddleWidth, paddleHeight);
	context.fillRect(clampedRightPaddleX, rightPaddleY, paddleWidth, paddleHeight);
}

function drawBall(
	context: CanvasRenderingContext2D,
	gameState: GameState,
	scale: Scale
) {
	const ballSize = gameState.constant.ballSize || 12;

	context.beginPath();
	context.arc(
		(gameState.ball.x + ballSize / 2) * scale.x,
		(gameState.ball.y + ballSize / 2) * scale.y,
		(ballSize / 2) * scale.x,
		0,
		Math.PI * 2
	);
	context.fillStyle = gameState.activeEffect
		? getEffectColor(gameState.activeEffect.type)
		: "#FFFFFF";
	context.fill();
	context.closePath();
}

function drawPowerUps(
	context: CanvasRenderingContext2D,
	gameState: GameState,
	scale: Scale
) {
	if (!gameState.powerUps?.length) return;

	gameState.powerUps.forEach((powerUp) => {
		const radius = 10 * scale.x;
		const x = powerUp.x * scale.x;
		const y = powerUp.y * scale.y;

		context.beginPath();
		context.arc(x, y, radius, 0, Math.PI * 2);
		context.fillStyle = getPowerUpColor(powerUp.type);
		context.fill();

		context.strokeStyle = "#FFFFFF";
		context.lineWidth = 1 * scale.x;
		context.stroke();
		context.closePath();

		context.fillStyle = "#000000";
		context.font = `bold ${10 * scale.x}px Arial`;
		context.textAlign = "center";
		context.textBaseline = "middle";
		context.fillText(getPowerUpSymbol(powerUp.type), x, y);
	});
}

function drawScores(
	context: CanvasRenderingContext2D,
	gameState: GameState,
	canvasDimensions: CanvasDimensions,
	scale: Scale
) {
	const fontSize = Math.max(32, 48 * scale.x);
	const centerX = canvasDimensions.width / 2;

	context.font = `bold ${fontSize}px Arial`;
	context.fillStyle = "#FFFFFF";

	context.textAlign = "right";
	context.fillText(`${gameState.score.p1}`, centerX - 30 * scale.x, 60 * scale.y);

	context.textAlign = "left";
	context.fillText(`${gameState.score.p2}`, centerX + 30 * scale.x, 60 * scale.y);
}

export function interpolateGameState(
	previousGameState: GameState | null,
	nextGameState: GameState,
	alpha: number
) {
	if (!previousGameState) return nextGameState;

	const shouldSkipInterpolation =
		previousGameState.status !== "playing" ||
		nextGameState.status !== "playing" ||
		previousGameState.score.p1 !== nextGameState.score.p1 ||
		previousGameState.score.p2 !== nextGameState.score.p2 ||
		previousGameState.winner !== nextGameState.winner ||
		previousGameState.result !== nextGameState.result;

	if (shouldSkipInterpolation) {
		return nextGameState;
	}

	return {
		...nextGameState,
		ball: {
			...nextGameState.ball,
			x: lerp(previousGameState.ball.x, nextGameState.ball.x, alpha),
			y: lerp(previousGameState.ball.y, nextGameState.ball.y, alpha),
		},
		paddles: {
			p1: {
				...nextGameState.paddles.p1,
				y: lerp(previousGameState.paddles.p1.y, nextGameState.paddles.p1.y, alpha),
			},
			p2: {
				...nextGameState.paddles.p2,
				y: lerp(previousGameState.paddles.p2.y, nextGameState.paddles.p2.y, alpha),
			},
		},
	};
}

export function renderGame(
	context: CanvasRenderingContext2D,
	gameState: GameState,
	canvasDimensions: CanvasDimensions,
	background: BackgroundId = 'default'
) {
	const scale = getScale(gameState, canvasDimensions);

	drawPitch(context, canvasDimensions, scale, background);
	drawPaddles(context, gameState, canvasDimensions, scale);
	drawBall(context, gameState, scale);
	drawPowerUps(context, gameState, scale);
	drawScores(context, gameState, canvasDimensions, scale);
}
