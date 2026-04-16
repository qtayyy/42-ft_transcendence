import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

const ACHIEVEMENTS = {
  FIRST_WIN: {
    key: "FIRST_WIN",
    name: "First Blood",
    description: "Win your first match",
    icon: "🎮",
    check: (stats) => stats.totalWins >= 1,
  },
  LEVEL_5: {
    key: "LEVEL_5",
    name: "Rising Star",
    description: "Reach level 5",
    icon: "⭐",
    check: (stats) => stats.level >= 5,
  },
  LEVEL_10: {
    key: "LEVEL_10",
    name: "Legendary Player",
    description: "Reach level 10",
    icon: "👑",
    check: (stats) => stats.level >= 10,
  },
  TOTAL_WINS_10: {
    key: "TOTAL_WINS_10",
    name: "Collector",
    description: "Accumulate 10 wins",
    icon: "🏆",
    check: (stats) => stats.totalWins >= 10,
  },
  TOTAL_WINS_50: {
    key: "TOTAL_WINS_50",
    name: "Champion",
    description: "Accumulate 50 wins",
    icon: "👑🏆",
    check: (stats) => stats.totalWins >= 50,
  },
  DRAW_MATCH: {
    key: "DRAW_MATCH",
    name: "Stalemate",
    description: "Play a draw match",
    icon: "⚖️",
    check: (stats) => stats.totalDraws >= 1,
  },
  TOURNAMENT_WIN: {
    key: "TOURNAMENT_WIN",
    name: "Tournament Victor",
    description: "Win a tournament",
    icon: "🏅",
    check: (stats) => stats.tournamentWins >= 1,
  },
};

function getAll() {
  return Object.values(ACHIEVEMENTS).map((a) => ({
    key: a.key,
    name: a.name,
    description: a.description,
    icon: a.icon,
  }));
}

function checkNew(stats) {
  return Object.values(ACHIEVEMENTS)
    .filter((a) => a.check(stats))
    .map((a) => a.key);
}

function getByKey(key) {
  return ACHIEVEMENTS[key];
}

/**
 * Check and award new achievements for a user
 * @param {number} profileId - User profile ID
 * @param {Object} prismaClient - Prisma client (for transactions)
 */
async function checkAndAwardAchievements(profileId, prismaClient = null) {
  const tx = prismaClient ?? prisma;

  try {
    // Get user's current stats
    const profile = await tx.profile.findUnique({
      where: { id: profileId },
      select: {
        level: true,
        totalWins: true,
        totalLosses: true,
        totalDraws: true,
        tournamentsWon: true,
        achievements: {
          select: { achievementKey: true },
        },
      },
    });

    if (!profile) {
      console.error(`Profile ${profileId} not found for achievement check`);
      return [];
    }

    const stats = {
      level: profile.level,
      totalWins: profile.totalWins,
      totalLosses: profile.totalLosses,
      totalDraws: profile.totalDraws,
      tournamentWins: profile.tournamentsWon?.length || 0,
    };

    // Get already unlocked achievements
    const unlockedKeys = new Set(
      profile.achievements.map((a) => a.achievementKey)
    );

    // Check which achievements should be awarded
    const eligibleAchievements = checkNew(stats);

    // Award new achievements
    const newAchievements = [];
    for (const key of eligibleAchievements) {
      if (!unlockedKeys.has(key)) {
        try {
          await tx.achievement.create({
            data: {
              profileId,
              achievementKey: key,
            },
          });
          newAchievements.push(key);
          console.log(`🏆 Achievement unlocked for user ${profileId}: ${key}`);
        } catch (error) {
          // Ignore duplicate achievement errors (race condition)
          if (!error.message?.includes("Unique constraint")) {
            console.error(
              `Failed to award achievement ${key} to user ${profileId}:`,
              error
            );
          }
        }
      }
    }

    return newAchievements;
  } catch (error) {
    console.error(
      `Error checking achievements for user ${profileId}:`,
      error
    );
    return [];
  }
}

export { getAll, checkNew, getByKey, checkAndAwardAchievements };
