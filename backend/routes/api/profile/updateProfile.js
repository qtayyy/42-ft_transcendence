import { PrismaClient } from "../../../generated/prisma/index.js";
import fs, { createWriteStream } from "fs";
import path from "path";
import { pipeline } from 'stream/promises';

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  fastify.put(
    "/",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const userId = request.user.userId;
        const updates = {};
        let avatarUrl = null;

        if (request.isMultipart()) {
          const parts = request.parts();

          for await (const part of parts) {
            if (part.file) {
              const uploadDir = path.join(process.cwd(), "uploads");
              fs.mkdirSync(uploadDir, { recursive: true });

              const filename = `${userId}-${Date.now()}-${part.filename}`;
              const filepath = path.join(uploadDir, filename);
              await pipeline(part.file, fs.createWriteStream(filepath));
              avatarUrl = `/uploads/${filename}`;
            } else if (part.fieldname) {
              updates[part.fieldname] = part.value;
            }
          }
        } else {
          // JSON request
          Object.assign(updates, request.body);
        }
        
        updates.dob = updates.dob ? new Date(updates.dob) : null;

        const profile = await prisma.profile.findUnique({ where: { userId } });
        if (!profile) return reply.code(400).send({ error: "Profile not found" });

        await prisma.profile.update({
          where: { userId },
          data: { ...updates, ...(avatarUrl && { avatar: avatarUrl }) },
        });
        return reply
          .code(200)
          .send({ message: "Profile updated", success: true, avatarUrl });
      } catch (error) {
        console.error("Profile update failed:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
