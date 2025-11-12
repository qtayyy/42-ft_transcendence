import path from "node:path";
import AutoLoad from "@fastify/autoload";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pass --options via CLI arguments in command to enable these options.
export const options = {};

export default async function (fastify, opts) {
  // Place here your custom code!
  fastify.setErrorHandler((error, request, reply) => {
    console.error(error);

    if (
      error.name === "UnauthorizedError" ||
      error.code === "FST_JWT_NO_AUTHORIZATION_IN_HEADER"
    ) {
      return reply.code(401).send({ error: "Unauthorized request." });
    }

    reply.status(500).send({
      message: "Something went wrong!",
      error: error.message || "Unknown error",
    });
  });

  // Do not touch the following lines

  // This loads all plugins defined in plugins
  // those should be support plugins that are reused
  // through your application
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, "plugins"),
    options: Object.assign({}, opts),
  });

  // This loads all plugins defined in routes
  // define your routes in one of these
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, "routes"),
    options: Object.assign({}, opts),
  });
}
