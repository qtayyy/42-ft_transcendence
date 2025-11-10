export default async function (fastify, opts) {
  try {
    fastify.post(
      "/logout",
      {
        onRequest: [fastify.authenticate],
      },
      async (request, reply) => {
        reply
          .clearCookie("token", { path: "/" })
          .send({ message: "Logged out" });
      }
    );
  } catch (error) {
    console.error("Error occurred during logout:", error);
    return reply.code(500).send({ error: "Internal server error" });
  }
}
