import bcrypt from "bcrypt";
import { PrismaClient } from '../generated/prisma/index.js'

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  fastify.post('/api/auth/login', async (request, reply) => {
    const { email, password } = request.body;

    if (!email || !password) return reply.code(400).send({ error: "Missing fields"});

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) return reply.code(400).send({ error: "Incorrect email or password"});
    const match = await bcrypt.compare(password, user.password);
    if (match === false) return reply.code(400).send({ error: "Incorrect email or password"});
    
    const token = fastify.jwt.sign({
      userId: user.id,
      email: user.email,
    }, {
      expiresIn: '1h'
    });

    return reply.code(200).send({
      message: 'Login successful version2',
      token,
      user: {
        userId: user.id,
        email: user.email,
      }
    });
  });
}
