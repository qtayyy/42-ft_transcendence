import { PrismaClient } from "../../../../generated/prisma/index.js";

const prisma = new PrismaClient();
const MAX_PLAYERS = 8;

export default async function (fastify, opts) {
  fastify.get(
    "/create",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const hostId = Number(request.user.userId);
        const maxPlayers = request.query.maxPlayers ? Number(request.query.maxPlayers) : MAX_PLAYERS;
        const isTournament =
          String(request.query.tournament || "").toLowerCase() === "true";
        
        const profile = await prisma.profile.findUnique({
          where: { id: hostId },
        });

        console.log(
          `[createGameRoom API] hostId: ${hostId} (type: ${typeof hostId}), maxPlayers: ${maxPlayers}, isTournament: ${isTournament}`,
        );

        const existing = fastify.currentRoom.get(hostId);
        if (existing) {
          // User already has a room, return that room instead
          return reply.code(200).send({ roomId: existing, existing: true });
        }

        const roomId = fastify.createGameRoom(
          hostId,
          profile.username,
          maxPlayers,
          false,
          isTournament,
        );
        return reply.code(200).send({
          roomId,
        });
      } catch (error) {
        console.error("Error creating game room:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    },
  );
}
