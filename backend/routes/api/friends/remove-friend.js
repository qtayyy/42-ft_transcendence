import { PrismaClient } from "../../../generated/prisma/index.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  fastify.delete(
    "/:friendId",
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const myId = request.user.userId;
        const friendId = Number(request.params.friendId);

        if (isNaN(friendId) || friendId === myId) {
          return reply.status(400).send({ error: "Invalid friend ID" });
        }

        const friendship = await prisma.friendship.findFirst({
          where: {
            status: "ACCEPTED",
            OR: [
              { requesterId: myId, addresseeId: friendId },
              { requesterId: friendId, addresseeId: myId },
            ],
          },
        });

        if (!friendship) {
          return reply.status(404).send({ error: "Friendship not found" });
        }

        await prisma.friendship.delete({
          where: { id: friendship.id },
        });

        return reply.code(200).send({ message: "Friend removed successfully" });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );
}
