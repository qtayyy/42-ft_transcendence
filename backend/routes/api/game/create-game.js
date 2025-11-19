import { PrismaClient } from "../../../generated/prisma/index.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  fastify.post(
    "/create",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const userId = request.user.userId;
        const [player1, player2] = request.body;

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return reply.code(404).send({ error: "User not found" });

        return reply.code(200).send(
          {
            "matchId": "0001",
          }
        );

      } catch (error) {
        throw error;
      }
    }
  );
}
