import assert from "node:assert/strict";
import test from "node:test";

import { PADDLE_HEIGHT } from "../plugins/ws-utils/game-matches/engine.js";
import { PADDLE_SPEED } from "../plugins/ws-utils/game-matches/constants.js";
import { createUpdateGameStateHandler } from "../plugins/ws-utils/game-matches/handlers/update-game-state.js";

function createMatch(overrides = {}) {
  return {
    matchId: "match-1",
    gameStarted: false,
    paused: false,
    pausedAt: null,
    activeEffect: null,
    timer: { startTime: Date.now(), timeElapsed: 0, timeRemaining: 120000 },
    resumeReady: null,
    leftPlayer: {
      id: 1,
      username: "left",
      paddleY: 100,
      paddleHeight: PADDLE_HEIGHT,
      gamePaused: true,
      moving: "",
      movingExpiresAt: 0,
    },
    rightPlayer: {
      id: 2,
      username: "right",
      paddleY: 100,
      paddleHeight: PADDLE_HEIGHT,
      gamePaused: true,
      moving: "",
      movingExpiresAt: 0,
    },
    ...overrides,
  };
}

function createHarness(gameState = createMatch()) {
  const broadcasts = [];
  const sentMessages = [];
  let startCalls = 0;
  const sockets = new Map([
    [1, { id: "socket-left" }],
    [2, { id: "socket-right" }],
  ]);
  const fastify = {
    gameStates: new Map([[gameState.matchId, gameState]]),
    onlineUsers: sockets,
    matchSpectators: new Map(),
  };

  const handler = createUpdateGameStateHandler({
    fastify,
    safeSend(socket, message, userId) {
      sentMessages.push({ socket, message, userId });
    },
    broadcastState(state) {
      broadcasts.push(state);
    },
    startGameLoop() {
      startCalls += 1;
    },
  });

  return {
    broadcasts,
    fastify,
    gameState,
    handler,
    sentMessages,
    getStartCalls: () => startCalls,
  };
}

test("START input is ignored because remote starts use the server countdown", () => {
  const { broadcasts, gameState, handler, getStartCalls } = createHarness();

  handler(gameState.matchId, 1, "START");
  assert.equal(gameState.leftPlayer.gamePaused, true);
  assert.equal(gameState.rightPlayer.gamePaused, true);
  assert.equal(gameState.gameStarted, false);
  assert.equal(getStartCalls(), 0);

  handler(gameState.matchId, 2, "START");
  assert.equal(gameState.rightPlayer.gamePaused, true);
  assert.equal(gameState.gameStarted, false);
  assert.equal(getStartCalls(), 0);
  assert.equal(broadcasts.length, 0);
});

test("movement input applies exactly one paddle step while a match is running", () => {
  const gameState = createMatch({
    gameStarted: true,
    leftPlayer: {
      ...createMatch().leftPlayer,
      gamePaused: false,
      moving: "DOWN",
      movingExpiresAt: Date.now() + 1000,
    },
    rightPlayer: {
      ...createMatch().rightPlayer,
      gamePaused: false,
    },
  });
  const { handler } = createHarness(gameState);

  handler(gameState.matchId, 1, "DOWN");

  assert.equal(gameState.leftPlayer.paddleY, 100 + PADDLE_SPEED);
  assert.equal(gameState.leftPlayer.moving, "");
  assert.equal(gameState.leftPlayer.movingExpiresAt, 0);
});

test("movement input is ignored while paused but pause state is still broadcast", () => {
  const gameState = createMatch({
    gameStarted: true,
    paused: true,
    leftPlayer: {
      ...createMatch().leftPlayer,
      gamePaused: false,
    },
    rightPlayer: {
      ...createMatch().rightPlayer,
      gamePaused: false,
    },
  });
  const { broadcasts, handler } = createHarness(gameState);

  handler(gameState.matchId, 1, "DOWN");

  assert.equal(gameState.leftPlayer.paddleY, 100);
  assert.equal(broadcasts.length, 1);
});

test("remote PAUSE input is ignored by the authoritative server", () => {
  const pausedAt = Date.now() - 1000;
  const gameState = createMatch({
    gameStarted: true,
    paused: true,
    pausedAt,
    resumeReady: { LEFT: false, RIGHT: false },
    leftPlayer: {
      ...createMatch().leftPlayer,
      gamePaused: false,
    },
    rightPlayer: {
      ...createMatch().rightPlayer,
      gamePaused: false,
    },
  });
  const { broadcasts, handler, sentMessages } = createHarness(gameState);

  handler(gameState.matchId, 1, "PAUSE");
  assert.equal(gameState.paused, true);
  assert.equal(gameState.resumeReady.LEFT, false);
  assert.equal(gameState.resumeReady.RIGHT, false);
  assert.equal(gameState.pausedAt, pausedAt);
  assert.equal(sentMessages.length, 0);
  assert.equal(broadcasts.length, 0);
});
