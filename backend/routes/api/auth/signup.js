import bcrypt from "bcrypt";
import { PrismaClient } from "../../../generated/prisma/index.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  fastify.post("/signup", async (request, reply) => {
    try {
      const { email, password, fullName } = request.body;
      
      const pepper = process.env.SECURITY_PEPPER;
      const saltRounds = parseInt(process.env.SALT_ROUNDS);

      if (!email || !password || !fullName)
        return reply.code(400).send({ error: "Missing fields" });

      const existing = await prisma.profile.findUnique({ where: { email } });
      if (existing)
        return reply.code(400).send({ error: "Email already used" });

      // Combine Password with Pepper
      const passwordWithPepper = password + pepper;
      // Hash with Salt Rounds
      const passwordHash = await bcrypt.hash(passwordWithPepper, saltRounds);
      await prisma.user.create({
        data: {
          password: passwordHash,

          profile: {
            create: {
              email: email,
              avatar: "",
              username: email || "",
              fullname: fullName,
              dob: null,
              region: null,
            },
          },
        },
      });

      return reply
        .code(200)
        .send({
          message: "User registered",
        });
    } catch (error) {
      console.error("Error occurred during registration:", error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  });
}
