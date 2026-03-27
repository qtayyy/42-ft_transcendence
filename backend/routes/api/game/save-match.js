import { PrismaClient } from "../../../generated/prisma/index.js";
import { calculateXPForMatch, calculateLevelFromXP, determineResult } from "../../../services/xp-service.js";
import { checkNew as checkNewAchievements } from "../../../services/achievement-service.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
	fastify.post(
		"/save-match",
		{
			onRequest: [fastify.authenticate],
		},
		async (request, reply) => {
			try {
				const {
					matchId,
					player1Id,
					player2Id,
					score1,
					score2,
					mode,
					tournamentId
				} = request.body;

				// Validation
				if (score1 === undefined || score2 === undefined) {
					return reply.code(400).send({ error: "Scores are required" });
				}

				// Save match
				const match = await prisma.match.create({
					data: {
						player1Id: player1Id || null,
						player2Id: player2Id || null,
						score1,
						score2,
						mode: mode || "LOCAL",
						tournamentId: tournamentId || null,
					}
				});

				// Update stats for both players
				if (player1Id && player1Id > 0) {
					await updatePlayerStats(player1Id, score1, score2, mode);
				}
				if (player2Id && player2Id > 0) {
					await updatePlayerStats(player2Id, score2, score1, mode);
				}

				return reply.code(200).send({
					success: true,
					matchId: match.id,
					message: "Match saved successfully"
				});

			} catch (error) {
				console.error("Error saving match:", error);
				return reply.code(500).send({ error: "Failed to save match" });
			}
		}
	);
}

async function updatePlayerStats(profileId, playerScore, opponentScore, matchMode) {
	try {
		const result = determineResult(playerScore, opponentScore);
		const xpGained = calculateXPForMatch(matchMode, result);

		// Get current profile
		const profile = await prisma.profile.findUnique({
			where: { id: profileId },
			include: { achievements: true },
		});

		if (!profile) return;

		// Calculate new stats
		const newTotalXP = profile.totalXP + xpGained;
		const newLevel = calculateLevelFromXP(newTotalXP);
		const newTotalWins = profile.totalWins + (result === "win" ? 1 : 0);
		const newTotalLosses = profile.totalLosses + (result === "loss" ? 1 : 0);
		const newTotalDraws = profile.totalDraws + (result === "draw" ? 1 : 0);
		const isTournamentWin = result === "win" && (matchMode === "LOCAL_TOURNAMENT" || matchMode === "REMOTE_TOURNAMENT");

		// Update profile
		await prisma.profile.update({
			where: { id: profileId },
			data: {
				totalXP: newTotalXP,
				level: newLevel,
				totalWins: newTotalWins,
				totalLosses: newTotalLosses,
				totalDraws: newTotalDraws,
			},
		});

		// Check for new achievements
		const currentAchievements = profile.achievements.map(a => a.achievementKey);
		const newStats = {
			totalWins: newTotalWins,
			totalLosses: newTotalLosses,
			totalDraws: newTotalDraws,
			level: newLevel,
			totalXP: newTotalXP,
			tournamentWins: isTournamentWin ? 1 : 0,
		};

		const eligible = checkNewAchievements(newStats);

		// Unlock new achievements
		for (const achievementKey of eligible) {
			if (!currentAchievements.includes(achievementKey)) {
				try {
					await prisma.achievement.create({
						data: {
							profileId,
							achievementKey,
						},
					});
				} catch (e) {
					// Ignore duplicates
				}
			}
		}
	} catch (error) {
		console.error(`Error updating stats for player ${profileId}:`, error);
	}
}
