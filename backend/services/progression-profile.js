import { checkNew as checkNewAchievements } from "./achievement-service.js";
import {
    calculateLevelFromXP,
    calculateXPForMatch,
    determineResult,
} from "./xp-service.js";

/**
 * Apply per-player progression changes (XP, level, W/L/D, achievements)
 * for a single completed match result.
 */
export async function applyProfileProgression({
    prismaClient,
    profileId,
    playerScore,
    opponentScore,
    matchMode,
}) {
    const result = determineResult(playerScore, opponentScore);
    const xpGained = calculateXPForMatch(matchMode, result);

    const profile = await prismaClient.profile.findUnique({
        where: { id: profileId },
        include: { achievements: true },
    });

    if (!profile) {
        return { updated: false, reason: "profile-not-found" };
    }

    const newTotalXP = profile.totalXP + xpGained;
    const newLevel = calculateLevelFromXP(newTotalXP);
    const newTotalWins = profile.totalWins + (result === "win" ? 1 : 0);
    const newTotalLosses = profile.totalLosses + (result === "loss" ? 1 : 0);
    const newTotalDraws = profile.totalDraws + (result === "draw" ? 1 : 0);

    await prismaClient.profile.update({
        where: { id: profileId },
        data: {
            totalXP: newTotalXP,
            level: newLevel,
            totalWins: newTotalWins,
            totalLosses: newTotalLosses,
            totalDraws: newTotalDraws,
        },
    });

    const currentAchievements = profile.achievements.map(
        (achievement) => achievement.achievementKey,
    );
    const isTournamentWin =
        result === "win" &&
        (matchMode === "LOCAL_TOURNAMENT" || matchMode === "REMOTE_TOURNAMENT");

    const newStats = {
        totalWins: newTotalWins,
        totalLosses: newTotalLosses,
        totalDraws: newTotalDraws,
        level: newLevel,
        totalXP: newTotalXP,
        tournamentWins: isTournamentWin ? 1 : 0,
    };

    const eligibleAchievements = checkNewAchievements(newStats);
    for (const achievementKey of eligibleAchievements) {
        if (currentAchievements.includes(achievementKey)) {
            continue;
        }

        try {
            await prismaClient.achievement.create({
                data: {
                    profileId,
                    achievementKey,
                },
            });
        } catch {
            // Ignore duplicate achievement inserts from race/retry conditions.
        }
    }

    return {
        updated: true,
        result,
        xpGained,
        totalXP: newTotalXP,
        level: newLevel,
        totalWins: newTotalWins,
        totalLosses: newTotalLosses,
        totalDraws: newTotalDraws,
    };
}