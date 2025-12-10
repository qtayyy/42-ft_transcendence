import otplib from "otplib";
import { PrismaClient } from "/app/generated/prisma/index.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  fastify.post("/2fa/verify", async (request, reply) => {
    try {
      const { code } = request.body;
      const token = request.cookies.token;
      if (!token)
        return reply
          .code(401)
          .send({ error: "Token expired. Please re-login." });
      if (!code) return reply.code(401).send({ error: "Missing 2FA code." });

      // Verify temporary JWT to ensure users have passed the initial login stage.
      // The decoded token is then used to get the user ID.
      const decoded = await fastify.jwt.temp.verify(token);
      const userId = decoded.userId;

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user) return reply.code(401).send({ error: "Invalid user" });

      // Finally, we check if the OTP given is correct
      const isValid = otplib.authenticator.check(code, user.twoFASecret);
      // WIP: Add method using backup code
      if (!isValid)
        return reply.status(401).send({ error: "Invalid 2FA code" });
      const fullToken = fastify.jwt.sign(
        { userId: user.id },
        { expiresIn: "1h" }
      );

      const profile = await prisma.profile.findUnique({
        where: { id: user.id },
      });

      return reply
        .clearCookie("token", { path: "/" })
        .setCookie("token", fullToken, {
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
        });
    } catch (error) {
      console.error("2FA verification error:", error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  fastify.post(
    "/2fa/enable/verify",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const { code } = request.body;
        const userId = request.user.userId;
        if (!code) return reply.code(401).send({ error: "Missing 2FA code." });

        const user = await prisma.user.findUnique({
          where: { id: userId },
        });
        if (!user) return reply.code(401).send({ error: "Invalid user" });

        const isValid = otplib.authenticator.check(code, user.twoFASecret);
        if (!isValid)
          return reply.status(401).send({ error: "Invalid 2FA code" });

        return reply
          .code(200)
          .send({
            message: "2FA enabled."
          });
      } catch (error) {
        console.error("2FA verification error:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
