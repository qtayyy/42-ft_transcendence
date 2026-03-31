import fp from "fastify-plugin";
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

export default fp(async function (fastify) {
  fastify.decorate("prisma", prisma);

  fastify.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
});
