import bcrypt from "bcrypt";
import { PrismaClient } from "../../../generated/prisma/index.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  fastify.post("/login", async (request, reply) => {
    const { email, password } = request.body;

    if (!email || !password)
      return reply.code(400).send({ error: "Missing fields" });

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user)
      return reply.code(400).send({ error: "Incorrect email or password" });
    const match = await bcrypt.compare(password, user.password);
    if (match === false)
      return reply.code(400).send({ error: "Incorrect email or password" });

    const twofaEnabled = user.twoFA;

    if (twofaEnabled) {
      return reply.code(401).send({
        message: "2FA enabled, please complete the authentication process",
        twofaUrl: "/api/auth/2fa/verify"
      });
    }
    else {
      const token = fastify.jwt.sign(
        {
          userId: user.id,
          email: user.email,
        },
        {
          expiresIn: "1h",
        }
      );

      return reply.code(200).send({
        message: "Login successful",
        token,
        user: {
          userId: user.id,
          email: user.email,
        },
      });
    }
  });
}
