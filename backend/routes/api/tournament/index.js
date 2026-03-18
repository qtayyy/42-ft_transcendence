import tournamentRoutes from "./tournament-routes.js";

// Fastify autoload mounts the directory prefix from this index file, so we keep
// the public route base at /api/tournament while delegating implementation to a
// more descriptive plugin file.
export default tournamentRoutes;
