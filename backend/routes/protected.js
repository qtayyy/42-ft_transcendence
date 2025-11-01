// Example of how to protect a route
export default async function (fastify, opts) {
  fastify.get(
    '/api/protected',
    {
      preHandler: [fastify.authenticate]
    },
    async (request, reply) => {
      return request.user
    }
  )
}
