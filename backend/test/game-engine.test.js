import assert from "node:assert/strict";
import test from "node:test";

import {
  BALL_SIZE,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  PADDLE_HEIGHT,
  PADDLE_WIDTH,
  applyPaddleStep,
  checkCollisionsAndScore,
  updateActiveEffect,
} from "../plugins/ws-utils/game-matches/engine.js";
import { PADDLE_SPEED } from "../plugins/ws-utils/game-matches/constants.js";

function createGameState(overrides = {}) {
  return {
    leftPlayer: {
      id: 1,
      username: "left",
      score: 0,
      paddleX: 20,
      paddleY: 100,
      paddleHeight: PADDLE_HEIGHT,
      moving: "",
      gamePaused: false,
    },
    rightPlayer: {
      id: 2,
      username: "right",
      score: 0,
      paddleX: CANVAS_WIDTH - PADDLE_WIDTH - 20,
      paddleY: 100,
      paddleHeight: PADDLE_HEIGHT,
      moving: "",
      gamePaused: false,
    },
    ball: {
      posX: (CANVAS_WIDTH - BALL_SIZE) / 2,
      posY: (CANVAS_HEIGHT - BALL_SIZE) / 2,
      dx: 4,
      dy: 3,
    },
    powerUps: [],
    activeEffect: null,
    timer: null,
    ...overrides,
  };
}

test("applyPaddleStep moves one authoritative step and clamps at court bounds", () => {
  const gameState = createGameState();

  gameState.leftPlayer.paddleY = 0;
  applyPaddleStep(gameState, "LEFT", "UP");
  assert.equal(gameState.leftPlayer.paddleY, 0);

  applyPaddleStep(gameState, "LEFT", "DOWN");
  assert.equal(gameState.leftPlayer.paddleY, PADDLE_SPEED);

  gameState.rightPlayer.paddleY = CANVAS_HEIGHT - PADDLE_HEIGHT + 5;
  applyPaddleStep(gameState, "RIGHT", "DOWN");
  assert.equal(gameState.rightPlayer.paddleY, CANVAS_HEIGHT - PADDLE_HEIGHT);
});

test("checkCollisionsAndScore bounces the ball off the right paddle", () => {
  const gameState = createGameState();
  gameState.ball = {
    posX: gameState.rightPlayer.paddleX - BALL_SIZE + 1,
    posY: gameState.rightPlayer.paddleY + PADDLE_HEIGHT / 2,
    dx: 4,
    dy: 0,
  };

  checkCollisionsAndScore(gameState);

  assert.equal(gameState.ball.posX, gameState.rightPlayer.paddleX - BALL_SIZE);
  assert.equal(gameState.ball.dx, -4);
  assert.equal(gameState.leftPlayer.score, 0);
  assert.equal(gameState.rightPlayer.score, 0);
});

test("checkCollisionsAndScore awards a point and resets toward the scorer", () => {
  const gameState = createGameState();
  gameState.ball.posX = CANVAS_WIDTH;

  checkCollisionsAndScore(gameState);

  assert.equal(gameState.leftPlayer.score, 1);
  assert.equal(gameState.rightPlayer.score, 0);
  assert.equal(gameState.ball.posX, (CANVAS_WIDTH - BALL_SIZE) / 2);
  assert.equal(gameState.ball.dx, -4);
});

test("updateActiveEffect expires speed and paddle-size effects back to defaults", () => {
  const speedState = createGameState({
    activeEffect: { type: "SPEED_UP", expiresAt: Date.now() - 1 },
  });
  speedState.ball.dx = -9;

  updateActiveEffect(speedState);

  assert.equal(speedState.activeEffect, null);
  assert.equal(speedState.ball.dx, -4);

  const sizeState = createGameState({
    activeEffect: { type: "SIZE_DOWN", expiresAt: Date.now() - 1 },
  });
  sizeState.leftPlayer.paddleHeight = 20;
  sizeState.rightPlayer.paddleHeight = 20;

  updateActiveEffect(sizeState);

  assert.equal(sizeState.activeEffect, null);
  assert.equal(sizeState.leftPlayer.paddleHeight, PADDLE_HEIGHT);
  assert.equal(sizeState.rightPlayer.paddleHeight, PADDLE_HEIGHT);
});
