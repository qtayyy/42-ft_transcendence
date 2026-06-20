import bcrypt from "bcrypt";
import { PrismaClient } from "../../../generated/prisma/index.js";
import {
  normalizeEmail,
  replyIfValidationError,
  validatePasswordForLogin,
} from "../../../lib/auth-validation.js";
import { authRateLimit } from "../../../utils/auth-rate-limit.js";
import {
  establishSession,
  findActiveRemoteMatch,
  getTakeoverConflict,
  signSessionToken,
  takeoverRequiredReply,
} from "../../../services/session-service.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  fastify.post(
    "/login",
    { config: { rateLimit: authRateLimit.login } },
    async (request, reply) => {
    try {
      const { email: rawEmail, password: rawPassword, takeover = false } = request.body;
      const email = normalizeEmail(rawEmail);
      const password = validatePasswordForLogin(rawPassword);
      const pepper = process.env.SECURITY_PEPPER;

      const profile = await prisma.profile.findUnique({
        where: { email },
      });
      if (!profile)
        return reply.code(400).send({ error: "Incorrect email or password" });

      const user = await prisma.user.findUnique({
        where: { id: profile.id },
      });
      const passwordWithPepper = password + pepper;
      const match = await bcrypt.compare(passwordWithPepper, user.password);
      if (!match)
        return reply.code(400).send({ error: "Incorrect email or password" });

      const activeMatch = findActiveRemoteMatch(fastify, user.id);
      const takeoverConflict = getTakeoverConflict(fastify, user.id);
      if (takeoverConflict && takeover !== true) {
        return takeoverRequiredReply(reply, takeoverConflict);
      }

      // If user enabled 2FA, we send them a temporary JWT that will only be
      // checked by the /api/auth/2fa/verify route. This is needed to check
      // users that access the 'verify 2fa' route has at least passed the
      // initial login phase. In other words, the 'verify 2fa' route is
      // protected by the temporary JWT. Note that this temporary JWT CANNOT
      // be used to access other protected routes.
      //
      // We store the JWT in a cookie to reduce the attack surface of XSS.
      // Read more on: https://github.com/fastify/fastify-jwt
      if (user.twoFA) {
        const token = fastify.jwt.temp.sign(
          { userId: profile.id, purpose: "2fa", takeover: takeover === true },
          { expiresIn: "5m" }
        );
        return reply
          .setCookie("token", token, {
            path: "/", // Should be fine
            secure: true,
            httpOnly: true,
            sameSite: true,
            maxAge: 300,
          })
          .code(202)
          .send({
            message: "2FA enabled, please complete the authentication process",
          });
      } else {
        // Else, we straight away assign the full JWT that is used to protect
        // all other sensitive routes.
        const sessionVersion = await establishSession(fastify, prisma, user.id);
        const token = signSessionToken(fastify, profile.id, sessionVersion);

        return reply
          .setCookie("token", token, {
            path: "/",
            secure: true,
            httpOnly: true,
            sameSite: true,
            maxAge: 3600,
          })
          .code(200)
          .send({
            message: "Login successful",
            profile: profile,
            activeMatch: activeMatch || undefined,
          });
      }
    } catch (error) {
      if (replyIfValidationError(error, reply)) return;
      console.error("Error occurred during login:", error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  },
  );
}
