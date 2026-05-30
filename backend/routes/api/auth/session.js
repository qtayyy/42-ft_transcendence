import { PrismaClient } from "../../../generated/prisma/index.js";

const prisma = new PrismaClient();

/**
 * Sends a successful anonymous session response instead of a 401.
 * This endpoint is used by the frontend as a quiet auth probe.
 */
function sendAnonymousSession(reply) {
  return reply.code(200).send({
    authenticated: false,
    profile: null,
  });
}

export default async function (fastify, opts) {
  fastify.get("/session", async (request, reply) => {
    const token = request.cookies.token;

    if (!token) {
      return sendAnonymousSession(reply);
    }

    try {
      const decoded = await fastify.jwt.verify(token);
      const profile = await prisma.profile.findUnique({
        where: { id: decoded.userId },
      });

      if (!profile) {
        return sendAnonymousSession(reply);
      }

      return reply.code(200).send({
        authenticated: true,
        profile,
      });
    } catch {
      return sendAnonymousSession(reply);
    }
  });
}
