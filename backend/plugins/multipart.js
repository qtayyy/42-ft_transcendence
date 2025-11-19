import multipart from "@fastify/multipart";
import fp from 'fastify-plugin'

export default fp(async (fastify) => {
  fastify.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024,
    }
  });
})
