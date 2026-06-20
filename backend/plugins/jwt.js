import fp from 'fastify-plugin'
import jwt from '@fastify/jwt'
import { PrismaClient } from '../generated/prisma/index.js'
import { SESSION_REPLACED_CODE } from '../services/session-service.js'

const prisma = new PrismaClient()

export default fp(async (fastify) => {
  if (!process.env.JWT_SECRET) {
    fastify.log.error('JWT_SECRET is not defined in environment variables')
    throw new Error('JWT_SECRET environment variable is required')
  }

  fastify.register(jwt, {
    secret: process.env.JWT_SECRET,
    cookie: {
      cookieName: 'token',
      signed: false
    }
  })

  fastify.decorate("authenticate", async function(request, reply) {
    try {
      await request.jwtVerify();
      const user = await prisma.user.findUnique({
        where: { id: Number(request.user.userId) },
        select: { sessionVersion: true },
      });
      if (!user || user.sessionVersion !== request.user.sessionVersion) {
        return reply.code(401).send({
          error: 'Your session was replaced by a login on another device.',
          code: SESSION_REPLACED_CODE,
        });
      }
    } catch (err) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  })
})
