import { PrismaClient } from "../../../generated/prisma/index.js";
import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import crypto from "crypto";
import sharp from "sharp";

const prisma = new PrismaClient();

const AVATAR_ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);
const AVATAR_MAX_EDGE = 512;

function safeFilename(userId, original) {
  const ext = path.extname(original).replace(/[^a-zA-Z0-9.]/g, "");
  const name = crypto.randomBytes(12).toString("hex");
  return `${userId}-${Date.now()}-${name}${ext}`;
}

/**
 * Validates and re-encodes an uploaded image to JPEG under uploads/.
 * Deletes the raw file on success or failure (replaced by output or removed as invalid).
 * @returns {Promise<string>} public URL path e.g. /uploads/…jpg
 */
async function validateAndReencodeAvatar(rawFilepath, userId) {
  const uploadDir = path.join(process.cwd(), "uploads");
  let meta;
  try {
    meta = await sharp(rawFilepath).metadata();
  } catch {
    throw new Error("Not a valid image file");
  }
  if (!meta.format || !AVATAR_ALLOWED_FORMATS.has(meta.format)) {
    throw new Error("Only JPEG, PNG, and WebP images are allowed");
  }

  const outBasename = `${userId}-${Date.now()}-${crypto.randomBytes(8).toString("hex")}.jpg`;
  const outPath = path.join(uploadDir, outBasename);

  await sharp(rawFilepath)
    .rotate()
    .resize(AVATAR_MAX_EDGE, AVATAR_MAX_EDGE, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85, mozjpeg: true })
    .toFile(outPath);

  try {
    fs.unlinkSync(rawFilepath);
  } catch {
    /* ignore */
  }

  return `/uploads/${outBasename}`;
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
        const ALLOWED_FIELDS = new Set(['email','username','dob','region','bio']);
        for await (const part of parts) {
          if (part.type === "file") {
            const uploadDir = path.join(process.cwd(), "uploads");
            fs.mkdirSync(uploadDir, { recursive: true });

            const filename = safeFilename(userId, part.filename);
            const filepath = path.join(uploadDir, filename);
            await pipeline(part.file, fs.createWriteStream(filepath));
            try {
              avatarUrl = await validateAndReencodeAvatar(filepath, userId);
            } catch (imgErr) {
              try {
                fs.unlinkSync(filepath);
              } catch {
                /* ignore */
              }
              return reply
                .code(400)
                .send({ error: imgErr.message || "Invalid avatar image" });
            }
          } else if (part.type === "field") {
            if (part.fieldname === "deleteAvatar" && part.value === "true") {
              deleteAvatar = true;
            } else if (ALLOWED_FIELDS.has(part.fieldname)) {
              updates[part.fieldname] = part.value;
            }
          }
        }

        updates.dob = updates.dob ? new Date(updates.dob) : null;

        if (Object.prototype.hasOwnProperty.call(updates, "username")) {
          updates.username = String(updates.username ?? "").trim();
          if (!updates.username) {
            return reply
              .code(400)
              .send({ error: "Username cannot be empty." });
          }
        }

        // Check if username is being updated and if it already exists for another user
        if (updates["username"]) {
          const existingProfile = await prisma.profile.findFirst({ 
            where: { username: updates["username"] } 
          });
          if (existingProfile && userId !== existingProfile.id) {
            return reply.code(400).send({ error: `Username: '${updates["username"]}' already exists.`});
          }
        }

        // Handle avatar deletion
        if (deleteAvatar) {
          // Get current profile to find old avatar path
          const currentProfile = await prisma.profile.findUnique({
            where: { id: userId }
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
            where: { id: userId }
          });
          
          if (currentProfile?.avatar) {
            const oldFilepath = path.join(process.cwd(), currentProfile.avatar);
            if (fs.existsSync(oldFilepath)) {
              fs.unlinkSync(oldFilepath);
            }
          }
        }

        await prisma.profile.update({
          where: { id: userId },
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
        // To-do: throw generic error
        throw error;
      }
    }
  );
}
