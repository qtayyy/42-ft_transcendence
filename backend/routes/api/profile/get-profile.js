import { PrismaClient } from "../../../generated/prisma/index.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  fastify.get(
    "/",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const userId = request.user.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return reply.code(400).send({ error: "Invalid user" });
        
        const profile = await prisma.profile.findUnique({
          where: { userId },
        });
        if (!profile)
          return reply.code(500).send({ error: "Profile not found" });

        return reply.code(200).send(profile);

      } catch (error) {
        console.error("Error fetching profile:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
