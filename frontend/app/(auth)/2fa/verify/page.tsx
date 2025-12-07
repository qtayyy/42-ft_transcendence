"use client";
import { AuthShell } from "@/components/auth-shell";
import React from "react";
import { useState } from "react";
import { AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

const fields = [{ name: "code", label: "2FA Code", type: "number" }];

export default function Verify2FAPage() {
  const [errorMessage, setErrorMessage] = useState("");
  const { verify2fa } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = Object.fromEntries(new FormData(form).entries());

    setErrorMessage("");

    const code = (data.code || "").toString().trim();
    if (!code || code.length < 6) {
      setErrorMessage("Please provide a 6-digit verification code.");
      return;
    }

    try {
      await verify2fa(code);
    } catch (error: any) {
      const backendError = error.response?.data?.error;
      setErrorMessage(
        backendError || "Something went wrong. Please try again later."
      );
    }
  };

  return (
    <AuthShell
      title="Two-factor Authentication"
      description="Enter the 6-digit code from your Google Auth App"
      handleSubmit={handleSubmit}
      fields={fields}
      link="/login"
      linkText="Back to Login"
      submitText="Submit"
    >
      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
    </AuthShell>
  );
}
