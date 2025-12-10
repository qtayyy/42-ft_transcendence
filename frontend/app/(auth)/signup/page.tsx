"use client";
import { AuthShell } from "@/components/auth-shell";
import React from "react";
import { useState } from "react";
import axios from "axios";
import { AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button"; // import buttons

const fields = [
  { name: "fullName", label: "Full Name", type: "text" },
  { name: "email", label: "Email", type: "email" },
  { name: "password", label: "Password", type: "password" },
];

export default function SignUpPage() {
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = Object.fromEntries(new FormData(form).entries());

    setErrorMessage("");
    setSuccessMessage("");

    const email = (data.email || "").toString().trim();
    const password = (data.password || "").toString().trim();
    const fullName = (data.fullName || "").toString().trim();

    if (!email || !password || !fullName) {
      setErrorMessage("Please fill in all required fields.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }

    try {
      const response = await axios.post("/api/auth/signup", data);

      if (response.status === 200) {
        setSuccessMessage("Sign up successful!");
        setTimeout(() => {
          setSuccessMessage("");
          router.push("/login");
        }, 800);
        
      }
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
        title="Sign Up"
        description="Create an account to start playing!"
        handleSubmit={handleSubmit}
        fields={fields}
        link="/login"
        linkText="Back to login"
        // submitText="Sign Up"
      >
        {/* Added Custom Sign Up Button */}
        <div className="mt-4">
              <Button 
                className="w-full" 
                type="submit"
            >
                Sign Up
            </Button>
        </div>

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
    </div>
  );
}
