import { PrismaClient } from "../generated/prisma/index.js";
import { checkNew as checkNewAchievements } from "./achievement-service.js";
import {
  calculateLevelFromXP,
  calculateXPForMatch,
  determineResult,
} from "./xp-service.js";

const prisma = new PrismaClient();

const TOURNAMENT_MATCH_MODES = new Set([
  "LOCAL_TOURNAMENT",
  "REMOTE_TOURNAMENT",
]);

/**
 * Normalize mixed caller mode values so progression logic can make the same
 * decisions regardless of whether the payload came from HTTP routes or the
 * websocket runtime.
 */
function normalizeMatchMode(mode) {
  if (typeof mode !== "string") {
    return "LOCAL";
  }

  return mode.trim().toUpperCase().replace(/-/g, "_");
}

/**
 * Compute the next persisted stats for a profile after a single completed
 * match. This mirrors the original save-match route behavior that previously
 * lived inline before match-finalization extracted the shared workflow.
 */
function buildUpdatedStats(profile, xpGained, result) {
  const totalXP = profile.totalXP + xpGained;
  const level = calculateLevelFromXP(totalXP);

  return {
    totalXP,
    level,
    totalWins: profile.totalWins + (result === "win" ? 1 : 0),
    totalLosses: profile.totalLosses + (result === "loss" ? 1 : 0),
    totalDraws: profile.totalDraws + (result === "draw" ? 1 : 0),
  };
}

/**
 * Translate the newly computed stats into achievement keys that should be
 * unlocked by this match only.
 */
function collectMissingAchievementKeys({
  currentAchievementKeys,
  updatedStats,
  matchMode,
  result,
}) {
  const eligibleAchievementKeys = checkNewAchievements({
    totalWins: updatedStats.totalWins,
    totalLosses: updatedStats.totalLosses,
    totalDraws: updatedStats.totalDraws,
    level: updatedStats.level,
    totalXP: updatedStats.totalXP,
    tournamentWins:
      result === "win" && TOURNAMENT_MATCH_MODES.has(matchMode) ? 1 : 0,
  });

  return eligibleAchievementKeys.filter(
    (achievementKey) => !currentAchievementKeys.has(achievementKey),
  );
}

/**
 * Persist newly earned achievements while tolerating duplicate writes from
 * overlapping retries or reconnect paths.
 */
async function unlockAchievements({
  prismaClient,
  profileId,
  achievementKeys,
}) {
  const unlockedAchievementKeys = [];

  for (const achievementKey of achievementKeys) {
    try {
      await prismaClient.achievement.create({
        data: {
          profileId,
          achievementKey,
        },
      });
      unlockedAchievementKeys.push(achievementKey);
    } catch (error) {
      if (error?.code !== "P2002") {
        throw error;
      }
    }
  }

  return unlockedAchievementKeys;
}

/**
 * Apply XP, level, win/loss/draw counters, and achievements for one profile
 * inside the caller's transaction.
 */
export async function applyProfileProgression({
  prismaClient = prisma,
  profileId,
  playerScore,
  opponentScore,
  matchMode,
}) {
  const normalizedMatchMode = normalizeMatchMode(matchMode);
  const result = determineResult(playerScore, opponentScore);
  const xpGained = calculateXPForMatch(normalizedMatchMode, result);

  const profile = await prismaClient.profile.findUnique({
    where: { id: profileId },
    select: {
      totalXP: true,
      level: true,
      totalWins: true,
      totalLosses: true,
      totalDraws: true,
      achievements: {
        select: {
          achievementKey: true,
        },
      },
    },
  });

  if (!profile) {
    throw new Error(`Profile ${profileId} not found for progression update`);
  }

  const updatedStats = buildUpdatedStats(profile, xpGained, result);

  await prismaClient.profile.update({
    where: { id: profileId },
    data: updatedStats,
  });

  const achievementKeysToUnlock = collectMissingAchievementKeys({
    currentAchievementKeys: new Set(
      profile.achievements.map((achievement) => achievement.achievementKey),
    ),
    updatedStats,
    matchMode: normalizedMatchMode,
    result,
  });

  const unlockedAchievementKeys = await unlockAchievements({
    prismaClient,
    profileId,
    achievementKeys: achievementKeysToUnlock,
  });

  return {
    result,
    xpGained,
    ...updatedStats,
    unlockedAchievementKeys,
  };
}
