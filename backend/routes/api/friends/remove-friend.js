import { PrismaClient } from "../../../generated/prisma/index.js";
import { safeSend } from "../../../utils/ws-utils.js";

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
          include: {
            requester: { select: { username: true } },
            addressee: { select: { username: true } },
          },
        });

        if (!friendship) {
          return reply.status(404).send({ error: "Friendship not found" });
        }

        await prisma.friendship.delete({
          where: { id: friendship.id },
        });

        const removerUsername =
          friendship.requesterId === myId
            ? friendship.requester.username
            : friendship.addressee.username;

        // Notify both clients so stale chat screens and friend lists close
        // immediately instead of waiting for a refresh or a rejected message.
        for (const recipient of [
          { userId: myId, friendId },
          { userId: friendId, friendId: myId },
        ]) {
          safeSend(
            fastify.onlineUsers.get(Number(recipient.userId)),
            {
              event: "FRIEND_REMOVED",
              payload: {
                friendId: recipient.friendId,
                removedById: myId,
                removedByUsername: removerUsername,
              },
            },
            recipient.userId,
          );
        }

        return reply.code(200).send({ message: "Friend removed successfully" });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );
}
