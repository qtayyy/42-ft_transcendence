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
	scale: Scale
) {
	context.fillStyle = "#000000";
	context.fillRect(0, 0, canvasDimensions.width, canvasDimensions.height);

	context.setLineDash([10 * scale.x, 10 * scale.x]);
	context.beginPath();
	context.moveTo(canvasDimensions.width / 2, 0);
	context.lineTo(canvasDimensions.width / 2, canvasDimensions.height);
	context.strokeStyle = "rgba(255, 255, 255, 0.3)";
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
	canvasDimensions: CanvasDimensions
) {
	const scale = getScale(gameState, canvasDimensions);

	drawPitch(context, canvasDimensions, scale);
	drawPaddles(context, gameState, canvasDimensions, scale);
	drawBall(context, gameState, scale);
	drawPowerUps(context, gameState, scale);
	drawScores(context, gameState, canvasDimensions, scale);
}
