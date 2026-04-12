import { GameState } from "@/types/game";
import { getPowerUpColor, getEffectColor, getPowerUpSymbol } from "./gameHelpers";

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

export const renderGame = (
	context: CanvasRenderingContext2D,
	gameState: GameState,
	canvasDimensions: { width: number; height: number },
	background: BackgroundId = 'default'
) => {
	const { width: w, height: h } = canvasDimensions;

	// Calculate scale factor based on actual canvas size vs game state size
	const scaleX = w / gameState.constant.canvasWidth;
	const scaleY = h / gameState.constant.canvasHeight;

	// Draw background
	switch (background) {
		case 'neon':   drawNeonBackground(context, w, h);   break;
		case 'retro':  drawRetroBackground(context, w, h);  break;
		case 'space':  drawSpaceBackground(context, w, h);  break;
		default:       drawDefaultBackground(context, w, h); break;
	}

	// Draw center line
	context.setLineDash([10 * scaleX, 10 * scaleX]);
	context.beginPath();
	context.moveTo(w / 2, 0);
	context.lineTo(w / 2, h);
	context.strokeStyle = getCenterLineColor(background);
	context.lineWidth = 2;
	context.stroke();
	context.setLineDash([]);

	// Draw Paddles (white)
	context.fillStyle = "white";

	// P1 paddle (left)
	const p1X = gameState.paddles.p1.x * scaleX;
	const p1Y = gameState.paddles.p1.y * scaleY;
	const paddleW = gameState.constant.paddleWidth * scaleX;
	const paddleH = gameState.constant.paddleHeight * scaleY;

	context.fillRect(p1X, p1Y, paddleW, paddleH);

	// P2 paddle (right) - ensure it's drawn within canvas bounds
	const p2X = gameState.paddles.p2.x * scaleX;
	const p2Y = gameState.paddles.p2.y * scaleY;

	// Clamp P2's X position to ensure paddle is fully visible
	const p2XClamped = Math.min(p2X, w - paddleW);

	context.fillRect(p2XClamped, p2Y, paddleW, paddleH);

	// Draw Ball
	context.beginPath();
	const ballSize = gameState.constant.ballSize || 12; // Use dynamic size
	context.arc(
		(gameState.ball.x + ballSize / 2) * scaleX,
		(gameState.ball.y + ballSize / 2) * scaleY,
		(ballSize / 2) * scaleX,
		0,
		Math.PI * 2
	);

	// Color ball if buffed, otherwise white
	context.fillStyle = gameState.activeEffect ? getEffectColor(gameState.activeEffect.type) : "#FFFFFF";
	context.fill();
	context.closePath();

	// Power-Ups
	if (gameState.powerUps) {
		gameState.powerUps.forEach(pu => {
			context.beginPath();
			// Scale power-up position and size (base radius 10 = size 20)
			const puRadius = 10 * scaleX;
			context.arc(pu.x * scaleX, pu.y * scaleY, puRadius, 0, Math.PI * 2);
			context.fillStyle = getPowerUpColor(pu.type);
			context.fill();

			// Hit box stroke
			context.strokeStyle = "#fff";
			context.lineWidth = 1 * scaleX;
			context.stroke();
			context.closePath();

			// Icon/Text inner
			context.fillStyle = "#000";
			context.font = `bold ${10 * scaleX}px Arial`;
			context.textAlign = "center";
			context.textBaseline = "middle";
			context.fillText(getPowerUpSymbol(pu.type), pu.x * scaleX, pu.y * scaleY);
		});
	}

	// Draw Scores
	const fontSize = Math.max(32, 48 * scaleX);
	context.font = `bold ${fontSize}px Arial`;
	context.fillStyle = "white";
	const centerX = w / 2;

	// Player 1 score (left)
	context.textAlign = "right";
	context.fillText(
		`${gameState.score.p1}`,
		centerX - 30 * scaleX,
		60 * scaleY
	);

	// Player 2 score (right)
	context.textAlign = "left";
	context.fillText(
		`${gameState.score.p2}`,
		centerX + 30 * scaleX,
		60 * scaleY
	);
};
