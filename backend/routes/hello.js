// export default async function (fastify, opts) {
//   fastify.get('/api/hello', async (request, reply) => {
//     return { message: 'Hello from Fastify backend!' }
//   })
// }

export default async function (fastify, opts) {
  fastify.get('/hello', async (request, reply) => {
    // This becomes /api/hello when loaded from /api directory
  })
}