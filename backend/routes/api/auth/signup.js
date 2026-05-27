import bcrypt from "bcrypt";
import { PrismaClient } from "../../../generated/prisma/index.js";
import {
  normalizeEmail,
  replyIfValidationError,
  validateFullName,
  validatePasswordForSet,
} from "../../../lib/auth-validation.js";
import { authRateLimit } from "../../../utils/auth-rate-limit.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  fastify.post(
    "/signup",
    { config: { rateLimit: authRateLimit.signup } },
    async (request, reply) => {
    try {
      const { email: rawEmail, password: rawPassword, fullName: rawFullName } =
        request.body;

      const email = normalizeEmail(rawEmail);
      const password = validatePasswordForSet(rawPassword);
      const fullName = validateFullName(rawFullName);

      const pepper = process.env.SECURITY_PEPPER;
      const saltRounds = parseInt(process.env.SALT_ROUNDS);

      const existing = await prisma.profile.findUnique({ where: { email } });
      if (existing)
        return reply.code(400).send({ error: "Email already used" });

      const usernameTaken = await prisma.profile.findFirst({
        where: { username: fullName },
      });
      if (usernameTaken) {
        return reply.code(400).send({
          error: "This name is already taken. Please choose another.",
        });
      }

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
              username: fullName,
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
      if (replyIfValidationError(error, reply)) return;
      console.error("Error occurred during registration:", error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  },
  );
}
