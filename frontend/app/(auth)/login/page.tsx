"use client";
import { AuthShell } from "@/components/auth-shell";
import React from "react";
import { useState } from "react";
import { AlertCircleIcon, Eye, EyeOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/context/languageContext";

const GOOGLE_AUTH_URL =
  (process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "") +
  "/api/auth/google/login";

export default function LoginPage() {
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const { t } = useLanguage();

  const fields = [
    { name: "email", label: t["Login & Sign up"].Email, type: "email" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = Object.fromEntries(new FormData(form).entries());

    setErrorMessage("");

    const email = (data.email || "").toString().trim();
    const password = (data.password || "").toString().trim();

    if (!email || !password) {
      setErrorMessage("Please fill in all required fields.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }

    try {
      await login(email, password);
    } catch (error: any) {
      const backendError = error.response?.data?.error;
      setErrorMessage(
        backendError || "Something went wrong. Please try again later."
      );
    }
  };

  return (
    <div>
      <AuthShell
        title={t["Login & Sign up"].Login}
        description={`${t["Login & Sign up"].Email} and ${t["Login & Sign up"].Password} OR ${t["Login & Sign up"].Login} with Google`}
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
            window.location.href = GOOGLE_AUTH_URL;
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
