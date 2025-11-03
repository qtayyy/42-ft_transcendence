import bcrypt from "bcrypt";
import { PrismaClient } from "../../../generated/prisma/index.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  fastify.post("/login", async (request, reply) => {
    try {
      const { email, password } = request.body;

      if (!email || !password)
        return reply.code(400).send({ error: "Missing fields" });

      const user = await prisma.user.findUnique({ where: { email } });

      if (!user)
        return reply.code(400).send({ error: "Incorrect email or password" });
      const match = await bcrypt.compare(password, user.password);
      if (match === false)
        return reply.code(400).send({ error: "Incorrect email or password" });

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
          { userId: user.id },
          { expiresIn: "5m" }
        );
        return reply
          .setCookie("token", token, {
            path: '/api/auth/2fa/verify', // double check
            secure: true,
            httpOnly: true,
            sameSite: true,
          })
          .code(401) // Or 200?
          .send({
            message: "2FA enabled, please complete the authentication process",
            twofaUrl: "/api/auth/2fa/verify",
          });
      } else {
        // Else, we straight away assign the full JWT that is used to protect
        // all other sensitive routes.
        const token = fastify.jwt.sign(
          { userId: user.id },
          { expiresIn: "1h" }
        );

        return reply
          .setCookie("token", token, {
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
      }
    } catch (error) {
      console.error("Error occurred during login:", error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  });
}
