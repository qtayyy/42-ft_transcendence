import fp from 'fastify-plugin'
import jwt from '@fastify/jwt'

export default fp(async (fastify) => {
  if (!process.env.JWT_SECRET) {
    fastify.log.error('JWT_SECRET is not defined in environment variables')
    throw new Error('JWT_SECRET environment variable is required')
  }

  fastify.register(jwt, {
    secret: process.env.JWT_SECRET
  })

  fastify.decorate("authenticate", async function(request, reply) {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.send(err)
    }
  })
})
