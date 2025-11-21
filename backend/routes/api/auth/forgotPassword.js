import crypto from "crypto";
import nodemailer from "nodemailer";
import { PrismaClient } from "../../../generated/prisma/index.js";

const prisma = new PrismaClient();

// Create email transporter 
const createTransporter = () => {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // Use TLS
    auth: {
      user: process.env.EMAIL_USER?.trim(),
      pass: process.env.EMAIL_PASSWORD,
    },
  });
};

// Generate random 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export default async function (fastify, opts) {
  // Step 1: Request OTP (send to email)
  fastify.post("/request-reset-otp", async (request, reply) => {
    
    try {
      const { email } = request.body;
          
      if (!email) {
        console.log("❌ No email provided");
        return reply.code(400).send({ error: "Email is required" });
      }

      const user = await prisma.user.findUnique({ where: { email } });
      
      // Check if user exists
      if (!user) {
        return reply.code(404).send({ 
          error: "Email not found. Please check your email address." 
        });
      }

      // Generate 6-digit OTP
      const otp = generateOTP();
      const otpExpiry = new Date(Date.now() + 60000); // 1 minute from now

      // Save OTP to database
      await prisma.user.update({
        where: { email },
        data: {
          resetOTP: otp,
          resetOTPExpiry: otpExpiry,
        },
      });

      
      try {
        const transporter = createTransporter();
        
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: "Password Reset OTP - FT Transcendence",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #333;">Password Reset Request</h2>
              <p>Hi there,</p>
              <p>We received a request to reset your password. Use the OTP code below to proceed:</p>
              <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 30px 0; border-radius: 8px;">
                <h1 style="color: #007bff; font-size: 36px; letter-spacing: 8px; margin: 0;">
                  ${otp}
                </h1>
              </div>
              <p><strong>This OTP will expire in 10 minutes.</strong></p>
              <p>If you didn't request this, you can safely ignore this email.</p>
              <hr style="border: 1px solid #eee; margin: 30px 0;">
              <p style="color: #999; font-size: 12px;">
                This is an automated message from FT Transcendence. Please do not reply to this email.
              </p>
            </div>
          `,
        });

        console.log(`✅ OTP EMAIL SENT to: ${email} | OTP: ${otp}`);
      } catch (emailError) {
        console.error("❌ Failed to send email:", emailError.message);
        return reply.code(500).send({ error: "Internal server error" });
      }

      return reply.code(200).send({ 
        message: "OTP has been sent to your email"
      });
    } catch (error) {
      console.error("Error in request OTP:", error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  // Step 2: Verify OTP
  fastify.post("/verify-reset-otp", async (request, reply) => {
    try {
      const { email, otp } = request.body;

      if (!email || !otp) {
        return reply.code(400).send({ error: "Email and OTP are required" });
      }

      const user = await prisma.user.findUnique({ where: { email } });

      if (!user || !user.resetOTP || !user.resetOTPExpiry) {
        return reply.code(400).send({ error: "Invalid OTP request" });
      }

      // Check if OTP expired
      if (new Date() > user.resetOTPExpiry) {
        return reply.code(400).send({ error: "OTP has expired. Please request a new one." });
      }

      // Verify OTP
      if (user.resetOTP !== otp.trim()) {
        return reply.code(400).send({ error: "Invalid OTP" });
      }

      return reply.code(200).send({ 
        message: "OTP verified successfully",
        verified: true 
      });
    } catch (error) {
      console.error("Error verifying OTP:", error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  // Step 3: Reset password with verified OTP
  fastify.post("/reset-password-with-otp", async (request, reply) => {
    try {
      const { email, otp, newPassword } = request.body;

      if (!email || !otp || !newPassword) {
        return reply.code(400).send({ error: "Email, OTP, and new password are required" });
      }

      if (newPassword.length < 6) {
        return reply.code(400).send({ error: "Password must be at least 6 characters long" });
      }

      const user = await prisma.user.findUnique({ where: { email } });

      if (!user || !user.resetOTP || !user.resetOTPExpiry) {
        return reply.code(400).send({ error: "Invalid reset request" });
      }

      // Check if OTP expired
      if (new Date() > user.resetOTPExpiry) {
        return reply.code(400).send({ error: "OTP has expired" });
      }

      // Verify OTP one last time
      if (user.resetOTP !== otp.trim()) {
        return reply.code(400).send({ error: "Invalid OTP" });
      }

      // Hash new password
      const bcrypt = await import("bcrypt");
      const passwordHash = await bcrypt.hash(newPassword, 10);

      // Update password and clear OTP
      await prisma.user.update({
        where: { email },
        data: {
          password: passwordHash,
          resetOTP: null,
          resetOTPExpiry: null,
        },
      });

      return reply.code(200).send({ message: "Password has been reset successfully" });
    } catch (error) {
      console.error("Error resetting password:", error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  });
}
