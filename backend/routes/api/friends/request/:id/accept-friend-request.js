import { PrismaClient } from "../../../../../generated/prisma/index.js";

const prisma = new PrismaClient();

/**
 * Registers the endpoint that lets an addressee accept an incoming friend
 * request. The handler treats an already-accepted request as idempotent
 * success, because duplicate clicks or another open tab can replay the same
 * action after the first request already committed.
 */
export default async function (fastify, opts) {
  fastify.put(
    "/accept",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const requestId = Number(request.params.id);
        const currentUserId = Number(request.user.userId);
        if (!Number.isInteger(requestId) || requestId <= 0) {
          return reply.status(400).send({ error: "Invalid friend request ID" });
        }

        const friendRequest = await prisma.friendship.findUnique({
          where: { id: requestId },
          select: {
            id: true,
            requesterId: true,
            addresseeId: true,
            status: true,
          },
        });
        if (!friendRequest) {
          return reply.status(404).send({ error: "Friend request not found" });
        }

        if (friendRequest.addresseeId !== currentUserId) {
          return reply.status(403).send({ error: "Forbidden" });
        }

        if (friendRequest.status === "ACCEPTED") {
          return reply
            .code(200)
            .send({ message: "Friend request already accepted" });
        }

        if (friendRequest.status !== "PENDING") {
          return reply
            .status(409)
            .send({ error: "Friend request is no longer pending" });
        }

        const updateResult = await prisma.friendship.updateMany({
          where: {
            id: requestId,
            addresseeId: currentUserId,
            status: "PENDING",
          },
          data: { status: "ACCEPTED" },
        });
        if (updateResult.count === 0) {
          const currentRequest = await prisma.friendship.findUnique({
            where: { id: requestId },
            select: { status: true },
          });
          if (!currentRequest) {
            return reply
              .status(404)
              .send({ error: "Friend request not found" });
          }

          if (currentRequest.status === "ACCEPTED") {
            return reply
              .code(200)
              .send({ message: "Friend request already accepted" });
          }

          return reply
            .status(409)
            .send({ error: "Friend request is no longer pending" });
        }

        // Notify the original requester in real-time that their request was accepted
        const accepter = await prisma.profile.findUnique({
          where: { id: currentUserId },
          select: { id: true, username: true, avatar: true },
        });
        if (accepter) {
          fastify.notifyFriendReq(friendRequest.requesterId, {
            event: "FRIEND_ACCEPTED",
            payload: {
              accepterId: accepter.id,
              accepterUsername: accepter.username,
              accepterAvatar: accepter.avatar ?? null,
            },
          });
        }

        return reply.code(200).send({ message: "Friend request accepted" });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );
}
