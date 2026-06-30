import assert from "node:assert/strict";
import test from "node:test";

import LegacyGameRuntime from "../game/LegacyGameRuntime.js";

function createSocket() {
  return {
    readyState: 1,
    sentMessages: [],
    send(message) {
      this.sentMessages.push(JSON.parse(message));
    },
  };
}

test("local tournament host can reconnect to a paused runtime and resume", () => {
  const game = new LegacyGameRuntime("local-tournament-demo-m1", "local");
  const firstSocket = createSocket();

  assert.equal(game.join(firstSocket, 42), "host");
  game.startGameLoop();
  assert.equal(game.running, true);
  assert.equal(game.gameState.status, "playing");

  game.pause();
  assert.equal(game.running, false);
  assert.equal(game.gameState.status, "paused");

  game.players.p1.socket = null;
  const reconnectSocket = createSocket();

  assert.equal(game.join(reconnectSocket, 42), "host");
  assert.equal(reconnectSocket.sentMessages.at(-1).status, "paused");

  game.resume();
  assert.equal(game.running, true);
  assert.equal(game.gameState.status, "playing");

  game.pause();
  assert.equal(game.running, false);
});

test("local runtime waits for start countdown before playing", async () => {
  const game = new LegacyGameRuntime("local-countdown-demo", "local");
  const socket = createSocket();

  assert.equal(game.join(socket, 42), "host");

  game.requestStartCountdown(0);
  assert.equal(game.running, false);
  assert.equal(game.gameState.status, "waiting");
  assert.equal(typeof game.gameState.startCountdownEndsAt, "number");
  assert.equal(game.gameState.startCountdownDurationMs, 0);
  assert.equal(socket.sentMessages.at(-1).status, "waiting");
  assert.equal(typeof socket.sentMessages.at(-1).startCountdownEndsAt, "number");
  assert.equal(socket.sentMessages.at(-1).startCountdownDurationMs, 0);

  await new Promise((resolve) => setTimeout(resolve, 5));

  assert.equal(game.running, true);
  assert.equal(game.gameState.status, "playing");
  assert.equal(game.gameState.startCountdownEndsAt, null);
  assert.equal(game.gameState.startCountdownDurationMs, null);

  game.pause();
  assert.equal(game.running, false);
});
