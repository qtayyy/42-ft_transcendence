import bcrypt from "bcrypt";
import { PrismaClient } from "../../../generated/prisma/index.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  fastify.post("/register", async (request, reply) => {
    try {
      const { email, password, fullName } = request.body;

      if (!email || !password)
        return reply.code(400).send({ error: "Missing fields" });

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing)
        return reply.code(400).send({ error: "Email already used" });

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: {
          email,
          password: passwordHash,

          profile: {
            create: {
              avatar: "",
              username: email,
              fullname: fullName,
              dob: null,
              region: null,
            },
          },
        },
      });
      return reply.code(200).send({ message: "User created:", user });
    } catch (error) {
      console.error("Error occurred during registration:", error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  });
}
