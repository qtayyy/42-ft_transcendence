"use client";
import { AuthShell } from "@/components/auth-shell";
import React, { useEffect, useRef, useState } from "react";
import { AlertCircleIcon, Eye, EyeOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/context/languageContext";
import { getGoogleAuthUrl } from "@/lib/runtime-url";
import {
  normalizeEmail,
  validatePasswordForLogin,
} from "@/lib/auth-validation";
import axios from "axios";

export default function LoginPage() {
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const { t } = useLanguage();
  const handledOAuthTakeover = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reason") === "session-replaced") {
      // Defer the notification so this effect only synchronizes with the URL
      // during its initial pass instead of causing a synchronous render loop.
      window.setTimeout(
        () => setErrorMessage("This account was signed in on another device."),
        0,
      );
    }
    if (params.get("oauthTakeover") !== "1" || handledOAuthTakeover.current) return;
    handledOAuthTakeover.current = true;

    const completeTakeover = async () => {
      const confirmed = window.confirm(
        "This account is currently in a match. Take over the session on this device? The old device will be disconnected.",
      );
      if (!confirmed) {
        setErrorMessage("Login cancelled. The active match remains on the other device.");
        return;
      }
      try {
        const response = await axios.post("/api/auth/session/takeover");
        const matchId = response.data.activeMatch?.matchId;
        window.location.assign(matchId ? `/game/${matchId}` : "/dashboard");
      } catch (error: unknown) {
        setErrorMessage(
          axios.isAxiosError(error)
            ? error.response?.data?.error || "The takeover request expired. Please log in again."
            : "The takeover request expired. Please log in again.",
        );
      }
    };
    void completeTakeover();
  }, []);

  const fields = [
    { name: "email", label: t["Login & Sign up"].Email, type: "email" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = Object.fromEntries(new FormData(form).entries());

    setErrorMessage("");

    const emailResult = normalizeEmail(data.email);
    if (!emailResult.ok) {
      setErrorMessage(emailResult.error);
      return;
    }

    const passwordResult = validatePasswordForLogin(data.password);
    if (!passwordResult.ok) {
      setErrorMessage(passwordResult.error);
      return;
    }

    try {
      await login(emailResult.value, passwordResult.value);
    } catch (error: unknown) {
      if (
        axios.isAxiosError(error) &&
        error.response?.data?.code === "ACTIVE_SESSION_IN_MATCH" &&
        window.confirm(
          "This account is currently in a match. Take over the session on this device? The old device will be disconnected.",
        )
      ) {
        try {
          await login(emailResult.value, passwordResult.value, true);
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
    <div>
      <AuthShell
        title={t["Login & Sign up"].Login}
        description={t["Login & Sign up"]["Email and Password OR Login with Google"]}
        handleSubmit={handleSubmit}
        fields={fields}
        link="/signup"
        linkText={t["Login & Sign up"]["Dont have an account?"]}
      // submitText="Login"
      >
        {/* Password field with eye icon */}
        <div className="grid gap-2">
          <Label htmlFor="password">{t["Login & Sign up"].Password}</Label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              id="password"
              name="password"
              required
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* 1. Forgot Password Link */}
        <div className="flex justify-end">
          <Link
            href="/reset-pwd"
            className="text-sm text-muted-foreground hover:text-primary underline"
          >
            {t["Login & Sign up"]["Forgot Password"]}
          </Link>
        </div>

        {/* 2. Login Button */}
        <Button className="w-full" type="submit">
          {t["Login & Sign up"].Login}
        </Button>

        {/* 3. The 'Or login with' Separator */}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border"></span>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              {t["Login & Sign up"]["OR Login with"]}
            </span>
          </div>
        </div>

        {/* 4. Google Button */}
        <Button
          variant="outline"
          type="button"
          className="w-full flex items-center justify-center gap-2 h-10"
          aria-label={`${t["Login & Sign up"]["Login with Google"]}`}
          onClick={() => {
            window.location.href = getGoogleAuthUrl();
          }}
        >
          <Image
            src="/google-icon.svg"
            alt="Google Logo"
            width={20}
            height={20}
          />
          {t["Login & Sign up"]["Login with Google"]}
        </Button>

        {/* 5. Error Alerts */}
        {errorMessage && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircleIcon className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}
      </AuthShell>
    </div>
  );
}
