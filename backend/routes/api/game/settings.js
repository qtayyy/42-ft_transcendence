import { PrismaClient } from "../../../generated/prisma/index.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  // GET /api/game/settings — return saved key bindings and background
  fastify.get(
    "/settings",
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      const userId = Number(request.user.userId);
      const profile = await prisma.profile.findUnique({
        where: { id: userId },
        select: { keyBindings: true, gameBackground: true, aiDifficulty: true },
      });
      if (!profile) return reply.code(404).send({ error: "Profile not found" });
      return reply.code(200).send({
        keyBindings: profile.keyBindings ?? null,
        gameBackground: profile.gameBackground ?? null,
        aiDifficulty: profile.aiDifficulty ?? null,
      });
    }
  );

  // PUT /api/game/settings — save key bindings and/or background
  fastify.put(
    "/settings",
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      const userId = Number(request.user.userId);
      const { keyBindings, gameBackground, aiDifficulty } = request.body;

      const VALID_DIFFICULTIES = new Set(["easy", "medium", "hard"]);
      const data = {};
      if (keyBindings !== undefined) data.keyBindings = keyBindings;
      if (gameBackground !== undefined) data.gameBackground = gameBackground;
      if (aiDifficulty !== undefined && VALID_DIFFICULTIES.has(aiDifficulty))
        data.aiDifficulty = aiDifficulty;

      if (Object.keys(data).length === 0)
        return reply.code(400).send({ error: "Nothing to update" });

      await prisma.profile.update({
        where: { id: userId },
        data,
      });
      return reply.code(200).send({ ok: true });
    }
  );
}
