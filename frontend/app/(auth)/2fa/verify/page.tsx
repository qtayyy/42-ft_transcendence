"use client";
import { AuthShell } from "@/components/auth-shell";
import React from "react";
import { useState } from "react";
import { AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/context/languageContext";
import { validateOtp } from "@/lib/auth-validation";
import axios from "axios";

export default function Verify2FAPage() {
  const [errorMessage, setErrorMessage] = useState("");
  const { verify2fa } = useAuth();
  const { t } = useLanguage();
  const fields = [
    {
      name: "code",
      label: t?.TwoFA?.["2FA Code"] || "2FA Code",
      type: "text",
      maxLength: 6,
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = Object.fromEntries(new FormData(form).entries());

    setErrorMessage("");

    const codeResult = validateOtp(data.code);
    if (!codeResult.ok) {
      setErrorMessage(
        codeResult.error ||
          (t?.TwoFA?.["Please provide a 6-digit verification code."] ||
            "Please provide a 6-digit verification code."),
      );
      return;
    }

    try {
      await verify2fa(codeResult.value);
    } catch (error: unknown) {
      if (
        axios.isAxiosError(error) &&
        error.response?.data?.code === "ACTIVE_SESSION_IN_MATCH" &&
        window.confirm(
          "This account is currently in a match. Take over the session on this device? The old device will be disconnected.",
        )
      ) {
        try {
          await verify2fa(codeResult.value, true);
        } catch (takeoverError: unknown) {
          setErrorMessage(
            axios.isAxiosError(takeoverError)
              ? takeoverError.response?.data?.error || "Unable to take over the session."
              : "Unable to take over the session.",
          );
        }
        return;
      }
      const backendError = axios.isAxiosError(error) ? error.response?.data?.error : null;
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
