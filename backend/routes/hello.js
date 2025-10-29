export default async function (fastify, opts) {
  fastify.get('/api/hello', async (request, reply) => {
    return { message: 'Hello from Fastify backend!' }
  })
}
