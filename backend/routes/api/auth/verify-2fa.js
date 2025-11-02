// Think of how to protect this route (only logged in users can come here)

export default async function (fastify, opts) {
  fastify.post("/2fa/verify", async (request, reply) => {
    const { code } = request.body;

    if (!code)
      return reply.code(400).send({ error: "Please provide your verification code" });
  })
}
