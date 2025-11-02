import otplib from "otplib";
import qrcode from "qrcode";
import { PrismaClient } from "../../../generated/prisma/index.js";
import * as crypto from "crypto";

const prisma = new PrismaClient();

function generateBackupCodes() {
  const codes = [];
  for (let i = 0; i < 10; i++) {
    codes.push(crypto.randomBytes(4).toString("hex"));
  }
  return codes;
}

export default async function (fastify, opts) {
  fastify.get(
    "/:userId/2fa/enable",
    {
      preHandler: [fastify.authenticate]
    },
    async (request, reply) => {
    try {
      const userId = parseInt(request.params.userId, 10);

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return reply.code(400).send({ error: "Invalid user" });
      if (user.twoFA)
        return reply.code(400).send({ error: "2FA already enabled"});
  
      const twoFASecret = otplib.authenticator.generateSecret();
      const backupCodes = generateBackupCodes();

      const imageUrl = await qrcode.toDataURL(
        otplib.authenticator.keyuri(userId, "ft_transcendence", twoFASecret)
      );

      const result = await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: {
            id: userId,
          },
          data: {
            twoFA: true,
            twoFASecret: twoFASecret,
            twoFABackup: backupCodes.toString(),
          },
        });
        return { twoFASecret, imageUrl, backupCodes };
      });
      return reply.send(result);
    } catch (error) {
      console.error("Error occurred during 2FA:", error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  });
}
