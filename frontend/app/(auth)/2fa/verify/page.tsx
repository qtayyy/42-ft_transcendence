"use client";
import { AuthShell } from "@/components/auth-shell";
import React from "react";
import { useState } from "react";
import { AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/context/languageContext";

export default function Verify2FAPage() {
  const [errorMessage, setErrorMessage] = useState("");
  const { verify2fa } = useAuth();
  const { t } = useLanguage();
  const fields = [{ name: "code", label: t?.TwoFA?.["2FA Code"] || "2FA Code", type: "number" }];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = Object.fromEntries(new FormData(form).entries());

    setErrorMessage("");

    const code = (data.code || "").toString().trim();
    if (!code || code.length < 6) {
      setErrorMessage(t?.TwoFA?.["Please provide a 6-digit verification code."] || "Please provide a 6-digit verification code.");
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
      title={t?.TwoFA?.["Two-factor Authentication"] || "Two-factor Authentication"}
      description={t?.TwoFA?.["Enter the 6-digit code from your Google Auth App"] || "Enter the 6-digit code from your Google Auth App"}
      handleSubmit={handleSubmit}
      fields={fields}
      link="/login"
      linkText={t?.TwoFA?.["Back to Login"] || "Back to Login"}
      submitText={t?.TwoFA?.["Submit"] || "Submit"}
    >
      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertTitle>{t?.TwoFA?.["Error"] || "Error"}</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
    </AuthShell>
  );
}
