import { GameState } from "@/types/game";
import { getPowerUpColor, getEffectColor, getPowerUpSymbol } from "./gameHelpers";

export const renderGame = (
	context: CanvasRenderingContext2D,
	gameState: GameState,
	canvasDimensions: { width: number; height: number }
) => {
	// Calculate scale factor based on actual canvas size vs game state size
	const scaleX = canvasDimensions.width / gameState.constant.canvasWidth;
	const scaleY = canvasDimensions.height / gameState.constant.canvasHeight;

	// Clear canvas
	context.fillStyle = "#000000"; // Black background
	context.fillRect(0, 0, canvasDimensions.width, canvasDimensions.height);

	// Draw center line
	context.setLineDash([10 * scaleX, 10 * scaleX]);
	context.beginPath();
	context.moveTo(canvasDimensions.width / 2, 0);
	context.lineTo(canvasDimensions.width / 2, canvasDimensions.height);
	context.strokeStyle = "rgba(255, 255, 255, 0.3)";
	context.lineWidth = 2;
	context.stroke();
	context.setLineDash([]);

	// Draw Paddles (white)
	context.fillStyle = "white";
	context.fillRect(
		gameState.paddles.p1.x * scaleX,
		gameState.paddles.p1.y * scaleY,
		gameState.constant.paddleWidth * scaleX,
		gameState.constant.paddleHeight * scaleY
	);
	context.fillRect(
		gameState.paddles.p2.x * scaleX,
		gameState.paddles.p2.y * scaleY,
		gameState.constant.paddleWidth * scaleX,
		gameState.constant.paddleHeight * scaleY
	);

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
	const centerX = canvasDimensions.width / 2;

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
