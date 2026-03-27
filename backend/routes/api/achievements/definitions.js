import { getAll } from "../../../services/achievement-service.js";

export default async function (fastify, opts) {
  fastify.get(
    "/",
    async (request, reply) => {
      try {
        const definitions = getAll();
        return reply.code(200).send(definitions);
      } catch (error) {
        console.error("Error fetching definitions:", error);
        return reply.code(500).send({ error: "Failed to fetch definitions" });
      }
    }
  );
}
