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
