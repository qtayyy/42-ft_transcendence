import { profile } from "console";
import { PrismaClient } from "../../../generated/prisma/index.js";

const prisma = new PrismaClient();

// Double check that user A cannot access user B's page
export default async function (fastify, opts) {
  fastify.get(
    "/",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const userId = request.user.userId;

        const user = await prisma.user.findUnique({ where: { id: userId }, select: { twoFA: true } });
        if (!user) return reply.code(404).send({ error: "User not found" });

        return reply.code(200).send(user.twoFA);
      } catch (error) {
       fastify.log.error("Error occurred fetching 2FA:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
