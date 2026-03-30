import fastifyStatic from "@fastify/static";
import fp from 'fastify-plugin'
import { getUploadsDir } from "../utils/storage-paths.js";

export default fp(async (fastify) => {
  fastify.register(fastifyStatic, {
  root: getUploadsDir(),
  prefix: "/uploads/",
});
})
