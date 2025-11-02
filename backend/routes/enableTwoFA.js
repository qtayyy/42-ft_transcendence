import otplib from "otplib";
import qrcode from "qrcode";
import { PrismaClient } from "../generated/prisma/index.js";
import * as crypto from 'crypto';

const prisma = new PrismaClient();

function generateBackupCodes() {
  const codes = [];
  for (let i = 0; i < 10; i++) {
    codes.push(crypto.randomBytes(4).toString("hex"));
  }
  return codes;
}

export default async function (fastify, opts) {
  fastify.post("/api/auth/enabletwoFA", async (request, reply) => {
    try {
      const { email } = request.body;
      if (!email) return reply.code(400).send({ error: "Email is missing" });

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return reply.code(400).send({ error: "Invalid user" });

      const twoFASecret = otplib.authenticator.generateSecret();
      const backupCodes = generateBackupCodes();

      await prisma.user.update({
        where: {
          email: email,
        },
        data: {
          twoFA: true,
          twoFASecret: twoFASecret,
          twoFABackup: backupCodes.toString(),
        },
      });

      const imageUrl = await qrcode.toDataURL(
        otplib.authenticator.keyuri(email, "ft_transcendence", twoFASecret)
      );
      return reply.send({ twoFASecret, imageUrl, backupCodes});
    } catch (error) {
      console.error("Error occurred during 2FA:", error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  });
}
