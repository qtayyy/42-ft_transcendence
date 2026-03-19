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

        await prisma.$transaction(async (tx) => {
          // Remove tournament membership and winner links without deleting
          // tournaments that may also belong to other players.
          const tournaments = await tx.tournament.findMany({
            where: {
              OR: [
                { winnerId: userId },
                { players: { some: { id: userId } } },
              ],
            },
            select: { id: true },
          });

          if (tournaments.length > 0) {
            await tx.tournament.updateMany({
              where: { winnerId: userId },
              data: { winnerId: null },
            });

            for (const tournament of tournaments) {
              await tx.tournament.update({
                where: { id: tournament.id },
                data: {
                  players: {
                    disconnect: { id: userId },
                  },
                },
              });
            }
          }

          // Delete records that directly reference the profile/user.
          await tx.match.deleteMany({
            where: {
              OR: [
                { player1Id: userId },
                { player2Id: userId },
              ],
            },
          });

          await tx.friendship.deleteMany({
            where: {
              OR: [
                { requesterId: userId },
                { addresseeId: userId },
              ],
            },
          });

          await tx.block.deleteMany({
            where: {
              OR: [
                { blockerId: userId },
                { blockedId: userId },
              ],
            },
          });

          await tx.message.deleteMany({
            where: {
              OR: [
                { senderId: userId },
                { recipientId: userId },
              ],
            },
          });

          await tx.profile.delete({
            where: { id: userId },
          });

          // Delete User after Profile because Profile.id references User.id.
          await tx.user.delete({
            where: { id: userId },
          });
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
