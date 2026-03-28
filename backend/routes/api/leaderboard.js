import { PrismaClient } from "../../generated/prisma/index.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  fastify.get("/leaderboard", async (request, reply) => {
    try {
      const limit = Math.min(Number(request.query.limit) || 100, 1000);
      const offset = Number(request.query.offset) || 0;

      const profiles = await prisma.profile.findMany({
        select: {
          id: true,
          username: true,
          avatar: true,
          level: true,
          totalXP: true,
          totalWins: true,
          totalLosses: true,
          totalDraws: true,
        },
        orderBy: [{ level: "desc" }, { totalXP: "desc" }, { totalWins: "desc" }],
        skip: offset,
        take: limit,
      });

      const total = await prisma.profile.count();

      const leaderboard = profiles.map((p, i) => {
        const g = p.totalWins + p.totalLosses + p.totalDraws;
        const winRate = g > 0 ? (p.totalWins / g) * 100 : 0;
        return {
          rank: offset + i + 1,
          userId: p.id,
          username: p.username,
          avatar: p.avatar,
          level: p.level,
          totalXP: p.totalXP,
          totalWins: p.totalWins,
          totalLosses: p.totalLosses,
          totalDraws: p.totalDraws,
          winRate: parseFloat(winRate.toFixed(2)),
        };
      });

      return reply.code(200).send({ leaderboard, total, limit, offset });
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      return reply.code(500).send({ error: "Failed to fetch leaderboard" });
    }
  });
}
