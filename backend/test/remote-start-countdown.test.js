import assert from "node:assert/strict";
import test from "node:test";

import {
  initializeRemoteStartCountdown,
  scheduleRemoteStartCountdown,
} from "../plugins/ws-utils/game-matches/start-countdown.js";

function createRemoteMatch() {
  return {
    matchId: "RS-countdown",
    gameStarted: false,
    gameOver: false,
    paused: false,
    leftPlayer: { id: 1, gamePaused: true },
    rightPlayer: { id: 2, gamePaused: true },
  };
}

test("remote start countdown marks both players ready and starts once", async () => {
  const gameState = createRemoteMatch();
  const fastify = {
    gameStates: new Map([[gameState.matchId, gameState]]),
  };
  let startCalls = 0;
  let broadcastCalls = 0;

  initializeRemoteStartCountdown(gameState, 0);
  scheduleRemoteStartCountdown({
    fastify,
    gameState,
    countdownMs: 0,
    broadcastState() {
      broadcastCalls += 1;
    },
    startGameLoop() {
      startCalls += 1;
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 5));

  assert.equal(gameState.leftPlayer.gamePaused, false);
  assert.equal(gameState.rightPlayer.gamePaused, false);
  assert.equal(gameState.gameStarted, true);
  assert.equal(gameState.startCountdownEndsAt, null);
  assert.equal(startCalls, 1);
  assert.equal(broadcastCalls, 1);
});
