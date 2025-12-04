import bcrypt from "bcrypt";
import { PrismaClient } from "../../../generated/prisma/index.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  fastify.post("/password",
    {
      onRequest: [fastify.authenticate],
    }, 
    async (request, reply) => {
    try {
      const { oldPassword, newPassword } = request.body;
      if (!oldPassword || !newPassword)
        return reply.code(400).send({ error: "Missing fields" });

      const userId = request.user.userId;
      const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return reply.code(400).send({ error: "Invalid user" });

      const match = await bcrypt.compare(oldPassword, user.password);
      if (match === false)
        return reply.code(400).send({ error: "Incorrect old password" });

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: userId },
        data: { password: passwordHash }
      });
      return reply.code(200).send({ message: "Password updated" });
    } catch (error) {
      console.error("Error occurred during password change:", error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  });
}
