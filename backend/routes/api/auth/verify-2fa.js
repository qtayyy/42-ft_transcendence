import otplib from "otplib";
import { PrismaClient } from "../../../generated/prisma/index.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  fastify.post("/2fa/verify", async (request, reply) => {
    try {
      const { code } = request.body;
      const token = request.cookies.token;

      if (!token || !code)
        return reply.code(401).send({ error: "Missing JWT or 2FA code" });

      // Verify temporary JWT to ensure users have passed the initial login stage.
      // The decoded token is then used to get the user ID.
      const decoded = await fastify.jwt.temp.verify(token);
      const userId = decoded.userId;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return reply.code(401).send({ error: "Invalid user" });

      // Finally, we check if the OTP given is correct
      const isValid = otplib.authenticator.check(code, user.twoFASecret);
      // WIP: Add method using backup code
      if (!isValid) return reply.status(401).send("Invalid 2FA token");

      const fullToken = fastify.jwt.sign(
          { userId: user.id },
          { expiresIn: "1h" }
        );

        return reply
          .setCookie("token", fullToken, {
            path: '/',
            secure: true,
            httpOnly: true,
            sameSite: true,
          })
          .code(200)
          .send({
            message: "Login successful",
            user: {
              userId: user.id,
            },
          });
    } catch (error) {
      console.error("2FA verification error:", error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  });
}
