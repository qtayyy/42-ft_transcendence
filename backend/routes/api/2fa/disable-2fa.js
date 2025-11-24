import { PrismaClient } from "../../../generated/prisma/index.js";

const prisma = new PrismaClient();

// Double check that user A cannot access user B's page
export default async function (fastify, opts) {
  fastify.get(
    "/disable",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const userId = request.user.userId;

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return reply.code(404).send({ error: "User not found" });
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
       fastify.log.error("Error occurred disabling 2FA:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
