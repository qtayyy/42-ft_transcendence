"use client";
import { AuthShell } from "@/components/auth-shell";
import React from "react";
import { useState, useEffect } from "react";
import axios from "axios";
import { AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetStep, setResetStep] = useState<"email" | "otp" | "password">(
    "email"
  );
  const [countdown, setCountdown] = useState(0);
  const router = useRouter();

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = Object.fromEntries(new FormData(form).entries());

    setErrorMessage("");
    setSuccessMessage("");

    if (resetStep === "email") {
      const email = (data.email || "").toString().trim();
      if (!email) {
        setErrorMessage("Please enter your email address.");
        return;
      }
      try {
        setResetEmail(email);
        await axios.post("/api/auth/request-reset-otp", {
          email,
        });
        setSuccessMessage("OTP has been sent to your email!");
        setResetStep("otp");
        setCountdown(60);
      } catch (error: any) {
        const backendError = error.response?.data?.error;
        setErrorMessage(
          backendError || "Failed to send OTP. Please try again."
        );
      }
    } else if (resetStep === "otp") {
      const otp = (data.otp || "").toString().trim();
      if (!otp) {
        setErrorMessage("Please enter the OTP.");
        return;
      }
      try {
        setOtp(otp);
        await axios.post("/api/auth/verify-reset-otp", {
          email: resetEmail,
          otp: otp,
        });
        setSuccessMessage("OTP verified! Now enter your new password.");
        setResetStep("password");
      } catch (error: any) {
        const backendError = error.response?.data?.error;
        setErrorMessage(backendError || "Invalid or expired OTP.");
      }
    } else if (resetStep === "password") {
      const newPassword = (data.newPassword || "").toString().trim();
      const confirmPassword = (data.confirmPassword || "").toString().trim();
      if (!newPassword || !confirmPassword) {
        setErrorMessage("Please fill in all fields.");
        return;
      }
      if (newPassword.length < 6 || confirmPassword.length < 6) {
        setErrorMessage("Password must be at least 6 characters long.");
        return;
      }

      if (newPassword !== confirmPassword) {
        setErrorMessage("Passwords do not match.");
        return;
      }

      try {
        await axios.post("/api/auth/reset-password-with-otp", {
          email: resetEmail,
          otp: otp,
          newPassword: newPassword,
        });
        setSuccessMessage("Password reset successful! You can now sign in.");
        setTimeout(() => {
          setResetStep("email");
          setResetEmail("");
          setOtp("");
          setSuccessMessage("");
          router.push("/login");
        }, 2000);
      } catch (error: any) {
        const backendError = error.response?.data?.error;
        setErrorMessage(backendError || "Failed to reset password.");
      }
    }
  };

  const handleResendOTP = async () => {
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await axios.post("/api/auth/request-reset-otp", { email: resetEmail });
      setSuccessMessage("OTP has been resent to your email!");
      setCountdown(60); // Restart countdown
    } catch (error: any) {
      const backendError = error.response?.data?.error;
      setErrorMessage(
        backendError || "Failed to resend OTP. Please try again."
      );
    }
  };

  return (
    <div>
      {resetStep === "email" && (
        <AuthShell
          title="Reset password"
          description="Enter your email address and we'll send you a 6-digit OTP to reset your password."
          handleSubmit={handleSubmit}
          fields={[{ name: "email", label: "Email", type: "email" }]}
          link="/login"
          linkText="Back to Login"
          submitText="Send OTP"
        >
          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircleIcon className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}
        </AuthShell>
      )}

      {resetStep === "otp" && (
        <AuthShell
          title="Reset password"
          description="We've sent a 6-digit OTP to your email."
          handleSubmit={handleSubmit}
          fields={[{ name: "otp", label: "OTP", type: "text" }]}
          link="/login"
          linkText="Back to Login"
          submitText="Submit OTP"
        >
          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircleIcon className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}
          {countdown > 0 ? (
            <p className="text-sm text-muted-foreground text-center">
              Resend OTP in <strong>{countdown}s</strong>
            </p>
          ) : (
            <button
              type="button"
              onClick={handleResendOTP}
              className="text-sm text-primary hover:underline w-full text-center"
            >
              Didn&apos;t receive OTP? Resend Code
            </button>
          )}
        </AuthShell>
      )}

      {resetStep === "password" && (
        <AuthShell
          title="Reset password"
          description="OTP verified! Now enter your new password."
          handleSubmit={handleSubmit}
          fields={[
            { name: "newPassword", label: "New Password", type: "password" },
            {
              name: "confirmPassword",
              label: "Confirm Password",
              type: "password",
            },
          ]}
          link="/login"
          linkText="Back to Login"
          submitText="Reset password"
        >
          {successMessage && (
            <Alert className="bg-green-500/10 border-green-500/50 text-green-600 dark:text-green-400">
              <AlertCircleIcon className="h-4 w-4" />
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          )}
          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircleIcon className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}
        </AuthShell>
      )}
    </div>
  );
}
