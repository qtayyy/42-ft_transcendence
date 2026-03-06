/*
===============================================================================
FILE PURPOSE
This module holds the pure game engine logic for remote Pong matches:
- Shared game constants
- Paddle and ball movement
- Collision and scoring
- Timer updates
- Power-up spawn, collision, and expiry handling
It intentionally has no Fastify/WebSocket side effects.
===============================================================================
*/

import crypto from "crypto";
import {
  BALL_SIZE,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  MATCH_DURATION,
  PADDLE_HEIGHT,
  PADDLE_SPEED,
  PADDLE_WIDTH,
  POWERUP_EFFECT_DURATION,
  POWERUP_SIZE,
  POWERUP_SPAWN_INTERVAL,
  TICK_MS,
} from "./constants.js";

export {
  BALL_SIZE,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  MATCH_DURATION,
  PADDLE_HEIGHT,
  PADDLE_WIDTH,
  POWERUP_SPAWN_INTERVAL,
  TICK_MS,
};

// Power-up types
const POWERUP_TYPES = ["SPEED_UP", "SPEED_DOWN", "SIZE_UP", "SIZE_DOWN"];

export function updatePaddles(gameState, player) {
  let currentPlayer = gameState.rightPlayer;
  if (player === "LEFT") currentPlayer = gameState.leftPlayer;
  if (currentPlayer.moving === "") return;

  // Use dynamic paddle height (may be modified by power-ups)
  const paddleHeight = currentPlayer.paddleHeight || PADDLE_HEIGHT;

  if (currentPlayer.moving === "UP")
    currentPlayer.paddleY = Math.max(0, currentPlayer.paddleY - PADDLE_SPEED);
  else
    currentPlayer.paddleY = Math.min(
      CANVAS_HEIGHT - paddleHeight,
      currentPlayer.paddleY + PADDLE_SPEED,
    );
}

export function updateBall(gameState) {
  let ball = gameState.ball;
  ball.posX += ball.dx;
  ball.posY += ball.dy;
}

export function resetBall(gameState, toRight = true) {
  gameState.ball.posX = (CANVAS_WIDTH - BALL_SIZE) / 2;
  gameState.ball.posY = (CANVAS_HEIGHT - BALL_SIZE) / 2;
  // Apply speed modifier if active effect is SPEED_UP or SPEED_DOWN
  let baseSpeed = 4;
  if (gameState.activeEffect) {
    if (gameState.activeEffect.type === "SPEED_UP") baseSpeed = 6;
    else if (gameState.activeEffect.type === "SPEED_DOWN") baseSpeed = 2;
  }
  gameState.ball.dx = toRight ? baseSpeed : -baseSpeed;
  gameState.ball.dy = 3 * (Math.random() > 0.5 ? 1 : -1);
}

// Spawn a random power-up on the field
export function spawnPowerUp(gameState) {
  // Don't spawn if there's already a power-up or if game hasn't started
  if (gameState.powerUps.length > 0) return;

  const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
  const id = crypto.randomUUID();

  // Spawn in middle third of the field (avoid paddles)
  const minX = CANVAS_WIDTH * 0.25;
  const maxX = CANVAS_WIDTH * 0.75;
  const x = minX + Math.random() * (maxX - minX);
  const y = POWERUP_SIZE + Math.random() * (CANVAS_HEIGHT - POWERUP_SIZE * 2);

  gameState.powerUps.push({ id, x, y, type });
}

// Check if ball collides with a power-up
export function checkPowerUpCollision(gameState) {
  const ball = gameState.ball;
  const ballCenterX = ball.posX + BALL_SIZE / 2;
  const ballCenterY = ball.posY + BALL_SIZE / 2;

  for (let i = gameState.powerUps.length - 1; i >= 0; i--) {
    const pu = gameState.powerUps[i];
    const distanceSq =
      Math.pow(ballCenterX - pu.x, 2) + Math.pow(ballCenterY - pu.y, 2);
    const radiusSum = BALL_SIZE / 2 + POWERUP_SIZE / 2;

    if (distanceSq < radiusSum * radiusSum) {
      // Collision! Apply effect
      gameState.powerUps.splice(i, 1);
      applyPowerUpEffect(gameState, pu.type);
      return;
    }
  }
}

// Apply power-up effect
function applyPowerUpEffect(gameState, type) {
  const now = Date.now();
  gameState.activeEffect = {
    type: type,
    expiresAt: now + POWERUP_EFFECT_DURATION,
  };

  // Apply immediate effects
  if (type === "SPEED_UP") {
    // Increase ball speed
    const speedMultiplier = 1.5;
    gameState.ball.dx =
      gameState.ball.dx > 0
        ? Math.abs(gameState.ball.dx) * speedMultiplier
        : -Math.abs(gameState.ball.dx) * speedMultiplier;
  } else if (type === "SPEED_DOWN") {
    // Decrease ball speed
    const speedMultiplier = 0.5;
    gameState.ball.dx =
      gameState.ball.dx > 0
        ? Math.abs(gameState.ball.dx) * speedMultiplier
        : -Math.abs(gameState.ball.dx) * speedMultiplier;
  } else if (type === "SIZE_UP") {
    // Increase paddle size for both players
    gameState.leftPlayer.paddleHeight = PADDLE_HEIGHT * 1.5;
    gameState.rightPlayer.paddleHeight = PADDLE_HEIGHT * 1.5;
  } else if (type === "SIZE_DOWN") {
    // Decrease paddle size for both players
    gameState.leftPlayer.paddleHeight = PADDLE_HEIGHT * 0.6;
    gameState.rightPlayer.paddleHeight = PADDLE_HEIGHT * 0.6;
  }
}

// Check and expire active effects
export function updateActiveEffect(gameState) {
  if (!gameState.activeEffect) return;

  const now = Date.now();
  if (now >= gameState.activeEffect.expiresAt) {
    // Reset effects based on type
    const type = gameState.activeEffect.type;

    if (type === "SPEED_UP" || type === "SPEED_DOWN") {
      // Reset ball speed to normal (preserve direction)
      const direction = gameState.ball.dx > 0 ? 1 : -1;
      gameState.ball.dx = 4 * direction;
    } else if (type === "SIZE_UP" || type === "SIZE_DOWN") {
      // Reset paddle sizes
      gameState.leftPlayer.paddleHeight = PADDLE_HEIGHT;
      gameState.rightPlayer.paddleHeight = PADDLE_HEIGHT;
    }

    gameState.activeEffect = null;
  }
}

// Update timer
export function updateTimer(gameState) {
  if (!gameState.timer) return;

  const now = Date.now();
  const elapsed = now - gameState.timer.startTime;
  gameState.timer.timeElapsed = elapsed;
  gameState.timer.timeRemaining = Math.max(0, MATCH_DURATION - elapsed);
}

export function checkCollisionsAndScore(gameState) {
  const ball = gameState.ball;

  // Collide with top
  if (ball.posY <= 0) {
    ball.posY = 0;
    ball.dy *= -1; // Flip the direction
  }
  // Collide with btm
  if (ball.posY + BALL_SIZE >= CANVAS_HEIGHT) {
    ball.posY = CANVAS_HEIGHT - BALL_SIZE;
    ball.dy *= -1; // Flip the direction
  }

  const leftPlayer = gameState.leftPlayer;
  const rightPlayer = gameState.rightPlayer;

  // Use dynamic paddle height (may be modified by power-ups)
  const leftPaddleHeight = leftPlayer.paddleHeight || PADDLE_HEIGHT;
  const rightPaddleHeight = rightPlayer.paddleHeight || PADDLE_HEIGHT;

  // Hit left paddle
  // First two conidtions give you a vertical slice
  // Last two give you a horizontal slice
  if (
    ball.posX <= leftPlayer.paddleX + PADDLE_WIDTH &&
    ball.posX + BALL_SIZE >= leftPlayer.paddleX &&
    ball.posY + BALL_SIZE >= leftPlayer.paddleY &&
    ball.posY <= leftPlayer.paddleY + leftPaddleHeight
  ) {
    ball.posX = leftPlayer.paddleX + PADDLE_WIDTH; // prevent sticking
    ball.dx = Math.abs(ball.dx); // Change x direction to RHS
    // Bounce down/up more if hit edges of the paddle
    const offset =
      ball.posY + BALL_SIZE / 2 - (leftPlayer.paddleY + leftPaddleHeight / 2);
    ball.dy = offset * 0.08;
  }

  if (
    ball.posX + BALL_SIZE >= rightPlayer.paddleX &&
    ball.posX <= rightPlayer.paddleX + PADDLE_WIDTH &&
    ball.posY + BALL_SIZE >= rightPlayer.paddleY &&
    ball.posY <= rightPlayer.paddleY + rightPaddleHeight
  ) {
    ball.posX = rightPlayer.paddleX - BALL_SIZE;
    ball.dx = -Math.abs(ball.dx);
    const offset =
      ball.posY + BALL_SIZE / 2 - (rightPlayer.paddleY + rightPaddleHeight / 2);
    ball.dy = offset * 0.08;
  }

  // Ball goes past left paddle - right player scores
  if (ball.posX <= 0) {
    gameState.rightPlayer.score += 1;
    resetBall(gameState, true); // Ball goes to right
  }
  // Ball goes past right paddle - left player scores
  else if (ball.posX + BALL_SIZE >= CANVAS_WIDTH) {
    gameState.leftPlayer.score += 1;
    resetBall(gameState, false); // Ball goes to left
  }
}
