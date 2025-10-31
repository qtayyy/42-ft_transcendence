import bcrypt from "bcrypt";
import { PrismaClient } from '../generated/prisma/index.js'

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  fastify.post('/api/auth/register', async (request, reply) => {
    const { email, password } = request.body;

    if (!email || !password) return reply.code(400).send({ error: "Missing fields" });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return reply.code(400).send({ error: "Email already used" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, password: passwordHash } });
    return reply.send({ message: "User created:", user });
  })
}
