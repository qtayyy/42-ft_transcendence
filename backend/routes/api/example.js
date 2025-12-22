export default async function (fastify, opts) {
  fastify.get('/hello', async (request, reply) => {
    return { message: 'Hello from Fastify backend!' }
  })
}
