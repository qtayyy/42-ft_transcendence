import fp from 'fastify-plugin'
import jwt from '@fastify/jwt'

export default fp(async (fastify) => {
  if (!process.env.TEMP_JWT_SECRET) {
    fastify.log.error('TEMP_JWT_SECRET is not defined in environment variables')
    throw new Error('TEMP_JWT_SECRET environment variable is required')
  }

  fastify.register(jwt, {
    secret: process.env.TEMP_JWT_SECRET,
    namespace: 'temp'
  })

  // fastify.decorate("authenticate", async function(request, reply) {
  //   try {
  //     await request.tempJwtVerify()
  //   } catch (err) {
  //     reply.send(err)
  //   }
  // })
})
