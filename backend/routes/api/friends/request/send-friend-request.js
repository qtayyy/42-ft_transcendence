import { PrismaClient } from "../../../../generated/prisma/index.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  fastify.post(
    "/",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const myId = request.user.userId;
        const { username } = request.body;

        const myProfile = await prisma.profile.findUnique({
          where: { id: myId },
        });
        if (!myProfile) return reply.code(400).send({ error: "Invalid user" });
        const addressee = await prisma.profile.findUnique({
          where: { username: username },
        });
        if (!addressee)
          return reply.code(400).send({ error: "User not found" });

        const addresseeId = addressee.id;
        if (!addresseeId)
          return reply.code(400).send({ error: "Missing addresseeId" });

        if (addresseeId === myId)
          return reply.code(400).send({ error: "Cannot add yourself" });

        const existing = await prisma.friendship.findFirst({
          where: {
            OR: [
              { requesterId: myId, addresseeId: addresseeId },
              { requesterId: addresseeId, addresseeId: myId },
            ],
          },
        });
        if (existing?.status === "PENDING")
          return reply.code(400).send({ error: "Request already sent" });
        if (existing?.status === "ACCEPTED")
          return reply.code(400).send({ error: "Already friends" });
        if (existing?.status === "DECLINED")
          await prisma.friendship.delete({ where: { id: existing.id } });

        await prisma.friendship.create({
          data: {
            requesterId: myId,
            addresseeId: addresseeId,
            status: "PENDING",
          },
        });

        const addresseeOnline = fastify.onlineUsers.get(addresseeId);
        if (addresseeOnline) {
          fastify.notifyFriendReq(addresseeId, {
            event: "FRIEND_REQUEST",
            payload: {
              requesterId: myId,
              requesterUsername: myProfile.username,
              addresseeId,
            },
          });
        }
        return reply.code(200).send({ message: "Friend request sent" });
      } catch (error) {
        console.error("Friend request error:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
