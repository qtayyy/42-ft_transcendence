"use client";
import { AuthShell } from "@/components/auth-shell";
import React from "react";
import { useState } from "react";
import { AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import Image from "next/image";

const fields = [
  { name: "email", label: "Email", type: "email" },
  { name: "password", label: "Password", type: "password" },
];

const GOOGLE_AUTH_URL =
  (process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "") +
  "/api/auth/google/login";

export default function LoginPage() {
  const [errorMessage, setErrorMessage] = useState("");
  // const Router = useRouter();
  const { login } = useAuth();

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
        title="Login"
        description="Enter your email and password OR login with Google"
      handleSubmit={handleSubmit}
      fields={fields}
      link="/signup"
      linkText="Don't have an account?"
      // submitText="Login"
    >
        {/* 1. Forgot Password Link */}
        <div className="flex justify-end">
          <Link
            href="/reset-pwd"
            className="text-sm text-muted-foreground hover:text-primary underline"
          >
            Forgot password?
          </Link>
        </div>

        {/* 2. Login Button */}
        <Button className="w-full" type="submit">
          Login
        </Button>

        {/* 3. The 'Or login with' Separator */}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border"></span>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or login with
            </span>
          </div>
        </div>

        {/* 4. Google Button */}
        <Button
          variant="outline"
          type="button"
          className="w-full flex items-center justify-center gap-2 h-10"
          aria-label="Login with Google"
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
          Login with Google
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
