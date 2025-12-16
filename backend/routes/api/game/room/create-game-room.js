import { PrismaClient } from "/app/generated/prisma/index.js";

const prisma = new PrismaClient();
const MAX_PLAYERS = 4;

export default async function (fastify, opts) {
  fastify.get(
    "/create",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const hostId = request.user.userId;
        const profile = await prisma.profile.findUnique({ where: { id: hostId } });

        const existing = fastify.currentRoom.get(hostId);
        if (existing) return reply.code(400).send({ error: "Already in a game room" });

        const roomId = fastify.createGameRoom(hostId, profile.username, MAX_PLAYERS);
        return reply.code(200).send({
          roomId,
        });
      } catch (error) {
        console.error("Error creating game room:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
