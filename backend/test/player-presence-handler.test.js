import assert from "node:assert/strict";
import test from "node:test";

import { createPlayerPresenceHandlers } from "../plugins/ws-utils/game-matches/handlers/player-presence.js";

/** Creates the minimum running remote-match state needed by presence handlers. */
function createRunningMatch() {
  return {
    matchId: "match-1",
    roomId: "room-1",
    gameStarted: true,
    gameOver: false,
    paused: false,
    pausedAt: null,
    timer: { startTime: Date.now() - 1000 },
    activeEffect: null,
    disconnectedPlayer: null,
    disconnectedPlayers: new Set(),
    leftPlayer: { id: 1, username: "left" },
    rightPlayer: { id: 2, username: "right" },
  };
}

test("disconnect pauses remote play and reconnect resumes it automatically", async () => {
  const gameState = createRunningMatch();
  const sentMessages = [];
  const broadcasts = [];
  const fastify = {
    gameStates: new Map([[gameState.matchId, gameState]]),
    onlineUsers: new Map([[1, {}], [2, {}]]),
    leaveRoom() {},
  };
  const handlers = createPlayerPresenceHandlers({
    fastify,
    safeSend(_socket, message, userId) {
      sentMessages.push({ message, userId });
    },
    broadcastState(state) {
      broadcasts.push({ paused: state.paused, resumeAt: state.resumeAt });
    },
    async endGame() {},
    reconnectResumeDelay: 20,
  });

  handlers.handlePlayerDisconnecting(gameState.matchId, 1);
  assert.equal(gameState.paused, true);
  assert.equal(gameState.disconnectedPlayer, "LEFT");

  handlers.handlePlayerReconnecting(gameState.matchId, 1);
  assert.equal(gameState.paused, true);
  assert.ok(gameState.resumeAt > Date.now());

  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(gameState.paused, false);
  assert.equal(gameState.pausedAt, null);
  assert.equal(gameState.resumeAt, null);
  assert.equal(
    sentMessages.filter(({ message }) => message.event === "GAME_RESUMED").length,
    2,
  );
  assert.equal(broadcasts.at(-1).paused, false);
});
