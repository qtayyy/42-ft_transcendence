import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeAIDifficulty,
  normalizePaddleMoveMessage,
  normalizeTournamentCreatePayload,
  normalizeTournamentMatchResultPayload,
} from "../lib/local-play-validation.js";

function createMatch(overrides = {}) {
  return {
    matchId: "local-tournament-123-m1",
    player1: { id: 1, name: "Host", isTemp: false },
    player2: { id: "temp-123-0", name: "Guest", isTemp: true },
    ...overrides,
  };
}

test("normalizes valid local tournament creation payloads", () => {
  const payload = normalizeTournamentCreatePayload(
    {
      tournamentId: "local-tournament-123",
      players: [
        { id: 1, name: "  Host  Player  ", isTemp: false },
        { id: "temp-123-0", name: "Guest One", isTemp: true },
        { id: "temp-123-1", name: "Guest Two", isTemp: true },
      ],
    },
    "RT-fallback",
  );

  assert.equal(payload.tournamentId, "local-tournament-123");
  assert.deepEqual(payload.players.map((player) => player.name), [
    "Host Player",
    "Guest One",
    "Guest Two",
  ]);
});

test("rejects tournaments outside the supported player count", () => {
  assert.throws(
    () =>
      normalizeTournamentCreatePayload(
        {
          tournamentId: "local-tournament-123",
          players: [
            { id: 1, name: "Host", isTemp: false },
            { id: "temp-123-0", name: "Guest", isTemp: true },
          ],
        },
        "RT-fallback",
      ),
    /3-8 players/,
  );
});

test("rejects duplicate or unsafe tournament player names", () => {
  assert.throws(
    () =>
      normalizeTournamentCreatePayload(
        {
          tournamentId: "local-tournament-123",
          players: [
            { id: 1, name: "Host", isTemp: false },
            { id: "temp-123-0", name: "guest", isTemp: true },
            { id: "temp-123-1", name: "Guest", isTemp: true },
          ],
        },
        "RT-fallback",
      ),
    /duplicate name/,
  );

  assert.throws(
    () =>
      normalizeTournamentCreatePayload(
        {
          tournamentId: "local-tournament-123",
          players: [
            { id: 1, name: "Host", isTemp: false },
            { id: "temp-123-0", name: "<script>", isTemp: true },
            { id: "temp-123-1", name: "Guest", isTemp: true },
          ],
        },
        "RT-fallback",
      ),
    /unsupported characters/,
  );
});

test("validates tournament match results against the scheduled players", () => {
  const result = normalizeTournamentMatchResultPayload(
    {
      matchId: "local-tournament-123-m1",
      player1Id: 1,
      player2Id: "temp-123-0",
      score: { p1: 5, p2: 3 },
      outcome: "win",
      durationSeconds: 121.2,
    },
    createMatch(),
  );

  assert.deepEqual(result.score, { p1: 5, p2: 3 });
  assert.equal(result.durationSeconds, 121);
});

test("rejects malformed tournament match results", () => {
  assert.throws(
    () =>
      normalizeTournamentMatchResultPayload(
        {
          matchId: "local-tournament-123-m1",
          player1Id: 2,
          player2Id: "temp-123-0",
          score: { p1: 5, p2: 3 },
          outcome: "win",
        },
        createMatch(),
      ),
    /Player 1 ID does not match/,
  );

  assert.throws(
    () =>
      normalizeTournamentMatchResultPayload(
        {
          matchId: "local-tournament-123-m1",
          player1Id: 1,
          player2Id: "temp-123-0",
          score: { p1: 5, p2: 3 },
          outcome: "draw",
        },
        createMatch(),
      ),
    /Draw results must have equal scores/,
  );
});

test("normalizes local websocket controls", () => {
  assert.equal(normalizeAIDifficulty("HARD"), "hard");
  assert.deepEqual(normalizePaddleMoveMessage({
    type: "PADDLE_MOVE",
    player: "2",
    direction: "DOWN",
  }), {
    type: "PADDLE_MOVE",
    player: 2,
    direction: "DOWN",
  });

  assert.throws(
    () =>
      normalizePaddleMoveMessage({
        type: "PADDLE_MOVE",
        player: 2,
        direction: "SIDEWAYS",
      }),
    /direction is invalid/,
  );
});
