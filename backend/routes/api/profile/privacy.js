import { PrismaClient } from "../../../generated/prisma/index.js";
import { validateShowEmail } from "../../../lib/profile-privacy.js";

const prisma = new PrismaClient();

/** Update the authenticated owner's public email visibility preference. */
export default async function (fastify) {
  fastify.put(
    "/privacy",
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const showEmail = validateShowEmail(request.body?.showEmail);
        const profile = await prisma.profile.update({
          where: { id: Number(request.user.userId) },
          data: { showEmail },
          select: { showEmail: true },
        });
        return reply.send(profile);
      } catch (error) {
        if (error.statusCode === 400) {
          return reply.code(400).send({ error: error.message });
        }
        if (error.code === "P2025") {
          return reply.code(404).send({ error: "Profile not found" });
        }
        console.error("Error updating profile privacy:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    },
  );
}
