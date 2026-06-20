import { PrismaClient } from "../../../generated/prisma/index.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  try {
    fastify.post(
      "/logout",
      {
        onRequest: [fastify.authenticate],
      },
      async (request, reply) => {
        // Revoke the cookie for every tab without presenting this intentional
        // logout as a hostile session replacement.
        await prisma.user.update({
          where: { id: Number(request.user.userId) },
          data: { sessionVersion: { increment: 1 } },
        });
        reply
          .clearCookie("token", { path: "/" })
          .send({ message: "Logged out" });
      }
    );
  } catch (error) {
    console.error("Error occurred during logout:", error);
    return reply.code(500).send({ error: "Internal server error" });
  }
}
