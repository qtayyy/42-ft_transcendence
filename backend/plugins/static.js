import path from "path";
import fastifyStatic from "@fastify/static";
import fp from 'fastify-plugin'

export default fp(async (fastify) => {
  fastify.register(fastifyStatic, {
  root: path.join(process.cwd(), "uploads"),
  prefix: "/uploads/",
});
})


