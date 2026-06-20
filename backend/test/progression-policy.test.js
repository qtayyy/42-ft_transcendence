import assert from "node:assert/strict";
import test from "node:test";

import {
  finalizeMatchResult,
  isProgressionEligibleMode,
} from "../services/match-finalization.js";
import { applyProfileProgression } from "../services/progression-profile.js";
import { awardRemoteTournamentChampion } from "../services/tournament-progression.js";

test("only remote modes are eligible for profile progression", () => {
  assert.equal(isProgressionEligibleMode("REMOTE"), true);
  assert.equal(isProgressionEligibleMode("remote-tournament"), true);
  assert.equal(isProgressionEligibleMode("LOCAL"), false);
  assert.equal(isProgressionEligibleMode("LOCAL_TOURNAMENT"), false);
  assert.equal(isProgressionEligibleMode("AI"), false);
});

test("local result is persisted without touching profile progression", async () => {
  let profileRead = false;
  const tx = {
    match: {
      async findUnique() {
        return null;
      },
      async upsert({ create }) {
        return { id: 7, ...create };
      },
    },
    profile: {
      async findUnique() {
        profileRead = true;
        throw new Error("local progression must not read a profile");
      },
    },
  };
  const prismaClient = {
    async $transaction(callback) {
      return callback(tx);
    },
  };

  const result = await finalizeMatchResult(
    {
      externalMatchId: "local-1",
      player1Id: 1,
      player2Id: null,
      score1: 5,
      score2: 0,
      durationSeconds: 30,
      mode: "LOCAL",
      tournamentId: null,
    },
    { prismaClient },
  );

  assert.equal(result.match.mode, "LOCAL");
  assert.equal(result.progressionApplied, false);
  assert.deepEqual(result.playerUpdates, []);
  assert.equal(profileRead, false);
});

test("private remote result cannot opt into progression implicitly", async () => {
  let profileRead = false;
  const tx = {
    match: {
      async findUnique() {
        return null;
      },
      async upsert({ create }) {
        return { id: 8, ...create };
      },
    },
    profile: {
      async findUnique() {
        profileRead = true;
        throw new Error("private remote progression must be disabled");
      },
    },
  };

  const result = await finalizeMatchResult(
    {
      externalMatchId: "private-remote-1",
      player1Id: 1,
      player2Id: 2,
      score1: 5,
      score2: 0,
      mode: "REMOTE",
    },
    { prismaClient: { $transaction: (callback) => callback(tx) } },
  );

  assert.equal(result.progressionApplied, false);
  assert.equal(profileRead, false);
});

test("public matchmade remote result applies progression when server opts in", async () => {
  let profileUpdates = 0;
  const tx = {
    match: {
      async findUnique() {
        return null;
      },
      async upsert({ create }) {
        return { id: 9, ...create };
      },
    },
    profile: {
      async findUnique() {
        return {
          totalXP: 0,
          level: 1,
          totalWins: 0,
          totalLosses: 0,
          totalDraws: 0,
          achievements: [],
        };
      },
      async update() {
        profileUpdates += 1;
      },
    },
    achievement: {
      async create() {},
    },
  };

  const result = await finalizeMatchResult(
    {
      externalMatchId: "matchmade-remote-1",
      player1Id: 1,
      player2Id: 2,
      score1: 5,
      score2: 0,
      mode: "REMOTE",
    },
    {
      prismaClient: { $transaction: (callback) => callback(tx) },
      progressionEligible: true,
    },
  );

  assert.equal(result.progressionApplied, true);
  assert.equal(profileUpdates, 2);
});

test("winning one remote tournament match does not grant champion achievement", async () => {
  const unlocked = [];
  const prismaClient = {
    profile: {
      async findUnique() {
        return {
          totalXP: 0,
          level: 1,
          totalWins: 0,
          totalLosses: 0,
          totalDraws: 0,
          achievements: [],
        };
      },
      async update() {},
    },
    achievement: {
      async create({ data }) {
        unlocked.push(data.achievementKey);
      },
    },
  };

  await applyProfileProgression({
    prismaClient,
    profileId: 1,
    playerScore: 5,
    opponentScore: 1,
    matchMode: "REMOTE_TOURNAMENT",
  });

  assert.ok(unlocked.includes("FIRST_WIN"));
  assert.equal(unlocked.includes("TOURNAMENT_WIN"), false);
});

test("completed remote tournament awards its registered champion once", async () => {
  const writes = [];
  const tournament = {
    tournamentId: "RT-room-1",
    progressionEligible: true,
    isComplete: () => true,
    getChampion: () => ({ playerId: 42, isTemp: false }),
  };
  const prismaClient = {
    achievement: {
      async create({ data }) {
        writes.push(data);
      },
    },
  };

  const result = await awardRemoteTournamentChampion(tournament, {
    prismaClient,
  });

  assert.deepEqual(result, { awarded: true, championId: 42 });
  assert.deepEqual(writes, [
    { profileId: 42, achievementKey: "TOURNAMENT_WIN" },
  ]);
});

test("local tournament cannot award the champion achievement", async () => {
  let writes = 0;
  const result = await awardRemoteTournamentChampion(
    {
      tournamentId: "local-tournament-1",
      isComplete: () => true,
      getChampion: () => ({ playerId: 1, isTemp: false }),
    },
    {
      prismaClient: {
        achievement: {
          async create() {
            writes += 1;
          },
        },
      },
    },
  );

  assert.equal(result.awarded, false);
  assert.equal(writes, 0);
});
