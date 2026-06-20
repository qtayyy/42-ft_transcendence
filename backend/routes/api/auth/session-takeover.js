import { PrismaClient } from "../../../generated/prisma/index.js";
import {
  establishSession,
  findActiveRemoteMatch,
  signSessionToken,
} from "../../../services/session-service.js";
import { authRateLimit } from "../../../utils/auth-rate-limit.js";

const prisma = new PrismaClient();

/** Complete a Google login after the user explicitly confirms a mid-game takeover. */
export default async function (fastify) {
  fastify.post(
    "/session/takeover",
    { config: { rateLimit: authRateLimit.login } },
    async (request, reply) => {
      try {
        const tempToken = request.cookies.token;
        if (!tempToken) {
          return reply.code(401).send({ error: "Takeover request expired." });
        }

        const decoded = await fastify.jwt.temp.verify(tempToken);
        if (decoded.purpose !== "oauth-takeover") {
          return reply.code(401).send({ error: "Invalid takeover request." });
        }

        const userId = Number(decoded.userId);
        const profile = await prisma.profile.findUnique({ where: { id: userId } });
        if (!profile) return reply.code(404).send({ error: "Invalid user" });

        const activeMatch = findActiveRemoteMatch(fastify, userId);
        const sessionVersion = await establishSession(fastify, prisma, userId);
        const token = signSessionToken(fastify, userId, sessionVersion);

        return reply
          .setCookie("token", token, {
            path: "/",
            secure: true,
            httpOnly: true,
            sameSite: true,
            maxAge: 3600,
          })
          .send({ message: "Login successful", profile, activeMatch });
      } catch {
        return reply.code(401).send({ error: "Takeover request expired." });
      }
    },
  );
}
