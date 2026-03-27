import { PrismaClient } from "../../../generated/prisma/index.js";
import { getByKey } from "../../../services/achievement-service.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  fastify.get(
    "/",
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const userId = Number(request.user.userId);

        const achievements = await prisma.achievement.findMany({
          where: { profileId: userId },
          select: { achievementKey: true, unlockedAt: true },
          orderBy: { unlockedAt: "desc" },
        });

        const enriched = achievements.map((ach) => {
          const def = getByKey(ach.achievementKey);
          return {
            key: ach.achievementKey,
            name: def?.name || ach.achievementKey,
            description: def?.description || "",
            icon: def?.icon || "🏆",
            unlockedAt: ach.unlockedAt,
          };
        });

        return reply.code(200).send(enriched);
      } catch (error) {
        console.error("Error fetching achievements:", error);
        return reply.code(500).send({ error: "Failed to fetch achievements" });
      }
    }
  );
}
