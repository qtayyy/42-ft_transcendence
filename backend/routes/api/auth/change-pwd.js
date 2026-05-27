import bcrypt from "bcrypt";
import { PrismaClient } from "../../../generated/prisma/index.js";
import {
  replyIfValidationError,
  validatePasswordForLogin,
  validatePasswordForSet,
} from "../../../lib/auth-validation.js";
import { authRateLimit } from "../../../utils/auth-rate-limit.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  fastify.post(
    "/password",
    {
      onRequest: [fastify.authenticate],
      config: { rateLimit: authRateLimit.changePassword },
    },
    async (request, reply) => {
    try {
      const { oldPassword: rawOldPassword, newPassword: rawNewPassword } =
        request.body;
      const oldPassword = validatePasswordForLogin(rawOldPassword);
      const newPassword = validatePasswordForSet(rawNewPassword);
      const pepper = process.env.SECURITY_PEPPER;
      const saltRounds = parseInt(process.env.SALT_ROUNDS);

      const userId = request.user.userId;
      const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return reply.code(400).send({ error: "Invalid user" });
      
      const oldPasswordWithPepper = oldPassword + pepper;
      const match = await bcrypt.compare(oldPasswordWithPepper, user.password);
      if (match === false)
        return reply.code(400).send({ error: "Incorrect old password" });

      const newPasswordWithPepper = newPassword + pepper;
      const passwordHash = await bcrypt.hash(newPasswordWithPepper, saltRounds);
      await prisma.user.update({
        where: { id: userId },
        data: { password: passwordHash }
      });
      return reply.code(200).send({ message: "Password updated" });
    } catch (error) {
      if (replyIfValidationError(error, reply)) return;
      console.error("Error occurred during password change:", error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  },
  );
}
