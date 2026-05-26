import { PrismaClient } from "../../../../generated/prisma/index.js";
import {
  normalizeRemoteRoomCreateQuery,
  normalizeRemoteUserId,
} from "../../../../lib/remote-play-validation.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  fastify.get(
    "/create",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const hostId = normalizeRemoteUserId(request.user.userId, "Host ID");
        const { maxPlayers, isTournament } = normalizeRemoteRoomCreateQuery(
          request.query,
        );

        const profile = await prisma.profile.findUnique({
          where: { id: hostId },
        });
        if (!profile) {
          return reply.code(404).send({ error: "Profile not found" });
        }

//         console.log(
//           `[createGameRoom API] hostId: ${hostId} (type: ${typeof hostId}), maxPlayers: ${maxPlayers}, isTournament: ${isTournament}`,
//         );

        const existing = fastify.currentRoom.get(hostId);
        if (existing) {
          const existingRoom = fastify.gameRooms.get(existing);
          if (!existingRoom) {
            fastify.currentRoom.delete(hostId);
          } else if (
            Boolean(existingRoom.isTournament) !== isTournament ||
            Number(existingRoom.maxPlayers) !== maxPlayers
          ) {
            return reply.code(409).send({
              error: "Already in a different remote room",
            });
          } else {
            // User already has a compatible room, return that room instead
            return reply.code(200).send({ roomId: existing, existing: true });
          }
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
        if (error.statusCode === 400) {
          return reply.code(400).send({ error: error.message });
        }
        return reply.code(500).send({ error: "Internal server error" });
      }
    },
  );
}
