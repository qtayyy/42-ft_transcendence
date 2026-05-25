import assert from "node:assert/strict";
import test from "node:test";

import {
  assertRemoteRoomCanStartSingle,
  assertRemoteRoomCanStartTournament,
  normalizeJoinMatchmakingPayload,
  normalizeJoinRoomByCodePayload,
  normalizeRemoteRoomCreateQuery,
  normalizeRemoteRoomId,
  normalizeRemoteTournamentPlayers,
  normalizeRemoteUsername,
  normalizeStartTournamentPayload,
} from "../lib/remote-play-validation.js";

const ROOM_ID = "550e8400-e29b-41d4-a716-446655440000";
const OTHER_ROOM_ID = "650e8400-e29b-41d4-a716-446655440001";

function createRemoteRoom(overrides = {}) {
  return {
    hostId: 1,
    invitedPlayers: [],
    joinedPlayers: [
      { id: 1, username: "Host" },
      { id: 2, username: "Guest" },
    ],
    maxPlayers: 2,
    isTournament: false,
    tournamentStarted: false,
    ...overrides,
  };
}

test("normalizes remote room creation query options", () => {
  assert.deepEqual(normalizeRemoteRoomCreateQuery({}), {
    maxPlayers: 2,
    isTournament: false,
  });
  assert.deepEqual(
    normalizeRemoteRoomCreateQuery({ tournament: "false", maxPlayers: "2" }),
    {
      maxPlayers: 2,
      isTournament: false,
    },
  );

  assert.deepEqual(
    normalizeRemoteRoomCreateQuery({ tournament: "true", maxPlayers: "8" }),
    {
      maxPlayers: 8,
      isTournament: true,
    },
  );

  assert.throws(
    () => normalizeRemoteRoomCreateQuery({ maxPlayers: "8" }),
    /Remote single requires exactly 2 players/,
  );

  assert.throws(
    () => normalizeRemoteRoomCreateQuery({ tournament: "true", maxPlayers: "2" }),
    /Remote tournaments require 3-8 players/,
  );
});

test("normalizes remote room and tournament identifiers", () => {
  assert.equal(normalizeRemoteRoomId(` ${ROOM_ID.toUpperCase()} `), ROOM_ID);
  assert.deepEqual(
    normalizeJoinRoomByCodePayload({
      roomId: ROOM_ID,
      mode: " Single ",
    }),
    {
      roomId: ROOM_ID,
      mode: "single",
    },
  );

  assert.deepEqual(
    normalizeStartTournamentPayload({
      roomId: ROOM_ID,
      tournamentId: `RT-${ROOM_ID}`,
    }),
    {
      roomId: ROOM_ID,
      tournamentId: `RT-${ROOM_ID}`,
    },
  );

  assert.throws(
    () => normalizeRemoteRoomId("../not-a-room"),
    /valid room code/,
  );
  assert.throws(
    () => normalizeJoinRoomByCodePayload({ roomId: ROOM_ID }),
    /mode is invalid/,
  );

  assert.throws(
    () =>
      normalizeStartTournamentPayload({
        roomId: ROOM_ID,
        tournamentId: `RT-${OTHER_ROOM_ID}`,
      }),
    /must match/,
  );
});

test("normalizes remote matchmaking mode and usernames", () => {
  assert.deepEqual(normalizeJoinMatchmakingPayload({ mode: " Tournament " }), {
    mode: "tournament",
  });
  assert.equal(normalizeRemoteUsername(" Host\nPlayer "), "HostPlayer");

  assert.throws(
    () => normalizeJoinMatchmakingPayload({ mode: "duel" }),
    /mode is invalid/,
  );
});

test("validates remote single start room shape", () => {
  assert.doesNotThrow(() => assertRemoteRoomCanStartSingle(createRemoteRoom()));

  assert.throws(
    () =>
      assertRemoteRoomCanStartSingle(
        createRemoteRoom({
          joinedPlayers: [{ id: 1, username: "Host" }],
        }),
      ),
    /exactly 2 players/,
  );

  assert.throws(
    () =>
      assertRemoteRoomCanStartSingle(
        createRemoteRoom({
          isTournament: true,
          maxPlayers: 4,
        }),
      ),
    /Tournament rooms cannot start/,
  );
});

test("validates remote tournament start room shape", () => {
  const tournamentRoom = createRemoteRoom({
    joinedPlayers: [
      { id: 1, username: "Host" },
      { id: 2, username: "Guest One" },
      { id: 3, username: "Guest Two" },
    ],
    maxPlayers: 8,
    isTournament: true,
  });

  assert.doesNotThrow(() => assertRemoteRoomCanStartTournament(tournamentRoom));

  assert.throws(
    () =>
      assertRemoteRoomCanStartTournament(
        createRemoteRoom({
          maxPlayers: 8,
          isTournament: true,
        }),
      ),
    /3-8 players/,
  );

  assert.throws(
    () =>
      assertRemoteRoomCanStartTournament(
        createRemoteRoom({
          joinedPlayers: Array.from({ length: 9 }, (_, index) => ({
            id: index + 1,
            username: `Player ${index + 1}`,
          })),
          maxPlayers: 8,
          isTournament: true,
        }),
      ),
    /3-8 players/,
  );
});

test("normalizes remote tournament room players for bracket creation", () => {
  const tournamentRoom = createRemoteRoom({
    joinedPlayers: [
      { id: "1", username: " Host Player " },
      { id: 2, username: "Guest One" },
      { id: 3, username: "Guest Two" },
    ],
    maxPlayers: 8,
    isTournament: true,
  });

  assert.deepEqual(normalizeRemoteTournamentPlayers(tournamentRoom), [
    { id: 1, name: "Host Player", isTemp: false },
    { id: 2, name: "Guest One", isTemp: false },
    { id: 3, name: "Guest Two", isTemp: false },
  ]);
});
