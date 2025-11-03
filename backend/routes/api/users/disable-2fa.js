import { PrismaClient } from "../../../generated/prisma/index.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  fastify.get(
    "/:userId/2fa/disable",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const userId = Number(request.params.userId);

        if (Number.isNaN(userId)) {
          return reply.code(400).send({ error: "Invalid user ID" });
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return reply.code(404).send({ error: "User not found" });
        if (request.user.id !== userId) {
          return reply.code(403).send({ error: "Forbidden" });
        }
        if (!user.twoFA)
          return reply.code(400).send({ error: "2FA already disabled" });

        await prisma.user.update({
          where: {
            id: userId,
          },
          data: {
            twoFA: false,
            twoFASecret: "",
            twoFABackup: "",
          },
        });
        return reply.code(200).send({ message: "2FA successfully disabled" });
      } catch (error) {
        fastify.log.error("Error occurred during 2FA:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
