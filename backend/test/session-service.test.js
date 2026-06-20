import assert from "node:assert/strict";
import test from "node:test";
import {
  establishSession,
  findActiveRemoteMatch,
  getTakeoverConflict,
  SESSION_REPLACED_CLOSE_CODE,
} from "../services/session-service.js";

/** Build the minimum Fastify state needed by the session service. */
function createFastifyState({ connected = true } = {}) {
  const socket = {
    readyState: 1,
    messages: [],
    send(message) {
      this.messages.push(JSON.parse(message));
    },
    close(code, reason) {
      this.closed = { code, reason };
    },
  };

  return {
    socket,
    fastify: {
      gameStates: new Map([
        [
          "match-7",
          {
            leftPlayer: { id: 7 },
            rightPlayer: { id: 8 },
            tournamentId: null,
            gameOver: false,
          },
        ],
      ]),
      onlineUsers: connected ? new Map([[7, new Set([socket])]]) : new Map(),
    },
  };
}

test("mid-match takeover requires an existing live session", () => {
  const connected = createFastifyState();
  assert.equal(findActiveRemoteMatch(connected.fastify, 7)?.matchId, "match-7");
  assert.equal(getTakeoverConflict(connected.fastify, 7)?.matchId, "match-7");

  const disconnected = createFastifyState({ connected: false });
  assert.equal(getTakeoverConflict(disconnected.fastify, 7), null);
});

test("establishing a session rotates its version and evicts old sockets", async () => {
  const { fastify, socket } = createFastifyState();
  const prisma = {
    user: {
      async update(query) {
        assert.deepEqual(query.data, { sessionVersion: { increment: 1 } });
        return { sessionVersion: 4 };
      },
    },
  };

  const version = await establishSession(fastify, prisma, 7);

  assert.equal(version, 4);
  assert.equal(socket.messages[0].event, "SESSION_REPLACED");
  assert.equal(socket.closed.code, SESSION_REPLACED_CLOSE_CODE);
});
