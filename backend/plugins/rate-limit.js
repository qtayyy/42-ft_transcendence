import fp from "fastify-plugin";
import rateLimit from "@fastify/rate-limit";

// global: false - applies rate limiting to routes within the encapsulation scope only.
export default fp(async (fastify) => {
  await fastify.register(rateLimit, {
    global: false,
  });
});
