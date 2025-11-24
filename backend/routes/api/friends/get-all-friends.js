import { PrismaClient } from "../../../generated/prisma/index.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  fastify.get(
    "/",
    { onRequest: [fastify.authenticate] },

    async (request, reply) => {
      try {
        const myId = request.user.userId;

        const friends = await prisma.friendship.findMany({
          where: {
            status: "ACCEPTED",
            OR: [{ requesterId: myId }, { addresseeId: myId }],
          },
          include: {
            requester: { select: { id: true, username: true } },
            addressee: { select: { id: true, username: true } },
          },
        });
        const cleanedFriends = friends.map((f) =>
          f.requesterId === myId ? f.addressee : f.requester
        );
        return reply.code(200).send(cleanedFriends);
      } catch (error) {
        console.error("Error fetching friends:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
