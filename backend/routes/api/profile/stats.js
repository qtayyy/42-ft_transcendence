import { PrismaClient } from "../../../generated/prisma/index.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  fastify.get(
    "/stats",
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const userId = Number(request.user.userId);

        const profile = await prisma.profile.findUnique({
          where: { id: userId },
          select: {
            totalXP: true,
            level: true,
            totalWins: true,
            totalLosses: true,
            totalDraws: true,
            achievements: { select: { achievementKey: true, unlockedAt: true } },
          },
        });

        if (!profile) {
          return reply.code(404).send({ error: "Profile not found" });
        }

        const total = profile.totalWins + profile.totalLosses + profile.totalDraws;
        const winRate = total > 0 ? (profile.totalWins / total) * 100 : 0;

        return reply.code(200).send({
          totalXP: profile.totalXP,
          level: profile.level,
          totalWins: profile.totalWins,
          totalLosses: profile.totalLosses,
          totalDraws: profile.totalDraws,
          winRate: parseFloat(winRate.toFixed(2)),
          totalGames: total,
          achievements: profile.achievements,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
        return reply.code(500).send({ error: "Failed to fetch stats" });
      }
    }
  );
}
