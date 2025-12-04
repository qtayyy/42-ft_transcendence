import { PrismaClient } from "../../../../generated/prisma/index.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  fastify.get(
    "/",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const identifier = request.query.user;

        const user = await prisma.profile.findFirst({
          where: {
            OR: [{ username: identifier }, { email: identifier }],
          },
        });

        if (!user) {
          return reply.code(404).send({ error: "User not found" });
        }
        return reply.code(200).send(user.username);
      } catch (error) {
        console.error("Error fetching friends:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
