import { PrismaClient } from "../../../generated/prisma/index.js";
import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import crypto from 'crypto';

const prisma = new PrismaClient();

function safeFilename(userId, original) {
  const ext = path.extname(original).replace(/[^a-zA-Z0-9.]/g, '');
  const name = crypto.randomBytes(12).toString('hex');
  return `${userId}-${Date.now()}-${name}${ext}`;
}

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
        let deleteAvatar = false;

        // For more info:
        // 1. https://www.npmjs.com/package/@fastify/multipart
        // 2. https://betterstack.com/community/guides/scaling-nodejs/fastify-file-uploads/
        const parts = request.parts();
        const ALLOWED_FIELDS = new Set(['email','username','dob','region']);
        for await (const part of parts) {
          if (part.type === "file") {
            const uploadDir = path.join(process.cwd(), "uploads");
            fs.mkdirSync(uploadDir, { recursive: true });

            const filename = safeFilename(userId, part.filename);
            const filepath = path.join(uploadDir, filename);
            await pipeline(part.file, fs.createWriteStream(filepath));
            avatarUrl = `/uploads/${filename}`;
          } else if (part.type === "field") {
            if (part.fieldname === "deleteAvatar" && part.value === "true") {
              deleteAvatar = true;
            } else if (ALLOWED_FIELDS.has(part.fieldname)) {
              updates[part.fieldname] = part.value;
            }
          }
        }

        updates.dob = updates.dob ? new Date(updates.dob) : null;

        // Check if username is being updated and if it already exists for another user
        if (updates["username"]) {
          const existingProfile = await prisma.profile.findFirst({ 
            where: { username: updates["username"] } 
          });
          if (existingProfile && userId !== existingProfile.userId) {
            return reply.code(400).send({ error: `Username: '${updates["username"]}' already exists.`});
          }
        }

        // Handle avatar deletion
        if (deleteAvatar) {
          // Get current profile to find old avatar path
          const currentProfile = await prisma.profile.findUnique({
            where: { userId }
          });
          
          // Delete old avatar file if it exists
          if (currentProfile?.avatar) {
            const oldFilepath = path.join(process.cwd(), currentProfile.avatar);
            if (fs.existsSync(oldFilepath)) {
              fs.unlinkSync(oldFilepath);
            }
          }
          
          avatarUrl = null;
        } else if (avatarUrl) {
          // New avatar uploaded, delete old one
          const currentProfile = await prisma.profile.findUnique({
            where: { userId }
          });
          
          if (currentProfile?.avatar) {
            const oldFilepath = path.join(process.cwd(), currentProfile.avatar);
            if (fs.existsSync(oldFilepath)) {
              fs.unlinkSync(oldFilepath);
            }
          }
        }

        await prisma.profile.update({
          where: { userId },
          data: { 
            ...updates, 
            ...(deleteAvatar ? { avatar: null } : avatarUrl ? { avatar: avatarUrl } : {})
          },
        });
        return reply
          .code(200)
          .send({ message: "Profile updated", success: true, avatarUrl });
      } catch (error) {
        if (error.code === "FST_REQ_FILE_TOO_LARGE") {
          return reply
            .code(400)
            .send({ error: "Image too large. Max size is 5MB." });
        }

        throw error;
      }
    }
  );
}
