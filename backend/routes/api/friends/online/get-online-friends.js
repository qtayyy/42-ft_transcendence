import { PrismaClient } from "../../../../generated/prisma/index.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  fastify.get(
    "/",
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const myId = request.user.userId;
        const onlineIds = Array.from(fastify.onlineUsers.keys());

        const onlineFriends = await prisma.friendship.findMany({
          where: {
            status: "ACCEPTED",
            OR: [
              { requesterId: myId, addresseeId: { in: onlineIds } },
              { addresseeId: myId, requesterId: { in: onlineIds } },
            ],
          },
          include: {
            requester: { select: { id: true, username: true } },
            addressee: { select: { id: true, username: true } },
          },
        });

        const cleanedFriends = onlineFriends.map((f) =>
          f.requesterId === myId ? f.addressee : f.requester
        );

        return reply.code(200).send(cleanedFriends);
      } catch (error) {
        console.error("Error fetching online friends:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
