"use client";
import { AuthShell } from "@/components/auth-shell";
import React from "react";
import { useState } from "react";
import axios from "axios";
import { AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";

const fields = [
  { name: "email", label: "Email", type: "email" },
  { name: "password", label: "Password", type: "password" },
];

export default function LoginPage() {
  const [errorMessage, setErrorMessage] = useState("");
  // const router = useRouter();
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
        submitText="Login"
      >
        <Link
          href="/reset-pwd"
          className="underline text-end text-gray-400 hover:text-gray-200"
        >
          Forgot password
        </Link>
        {errorMessage && (
          <Alert variant="destructive">
            <AlertCircleIcon className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}
      </AuthShell>
    </div>
  );
}
