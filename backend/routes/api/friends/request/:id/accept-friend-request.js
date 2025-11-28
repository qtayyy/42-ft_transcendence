import { PrismaClient } from "../../../../../generated/prisma/index.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  fastify.put(
    "/accept",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const requestId  = Number(request.params.id);
        const friendRequest = await prisma.friendship.findUnique({
          where: { id: requestId }
        });
        if (!friendRequest) return reply.status(404).send({ error: "Friend request not found" });

        if (friendRequest.addresseeId !== request.user.userId)
          return reply.status(403).send({ error: "Forbidden" });

        await prisma.friendship.update({
          where: { id: requestId },
          data: { status: "ACCEPTED" },
        });

        return reply.code(200).send("Friend request accepted");
      } catch (error) {}
    }
  );
}
