export default async function (fastify, opts) {
  fastify.get("/", { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const ip = process.env.HOST_IP || null;
    return reply.code(200).send({ ip, port: 8443 });
  });
}
