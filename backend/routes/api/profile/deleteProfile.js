import { PrismaClient } from "../../../generated/prisma/index.js";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  fastify.delete(
    "/",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const userId = request.user.userId;

        // Get user and profile to find avatar file
        const user = await prisma.user.findUnique({ 
          where: { id: userId },
          include: { profile: true }
        });

        if (!user) {
          return reply.code(404).send({ error: "User not found" });
        }

        // Delete avatar file if it exists
        if (user.profile?.avatar) {
          const avatarPath = user.profile.avatar.replace("/uploads/", "");
          const filePath = path.join(process.cwd(), "uploads", avatarPath);
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          } catch (error) {
            console.error("Error deleting avatar file:", error);
            // Continue with account deletion even if file deletion fails
          }
        }

        // Delete all related data in correct order to avoid foreign key constraints
        // 1. Delete Matches related to user's tournaments
        const tournaments = await prisma.tournaments.findMany({
          where: { userId },
          select: { id: true }
        });
        const tournamentIds = tournaments.map(t => t.id);
        
        if (tournamentIds.length > 0) {
          await prisma.matches.deleteMany({
            where: { tournamentId: { in: tournamentIds } }
          });
        }

        // 2. Delete Tournaments
        await prisma.tournaments.deleteMany({
          where: { userId }
        });

        // 3. Delete Friends
        await prisma.friends.deleteMany({
          where: { userId }
        });

        // 4. Delete Profile
        await prisma.profile.deleteMany({
          where: { userId }
        });

        // 5. Delete User (this will also delete the email)
        await prisma.user.delete({
          where: { id: userId }
        });

        return reply.code(200).send({ 
          message: "Account deleted successfully",
          success: true 
        });
      } catch (error) {
        console.error("Error deleting account:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}

