"use client";
import { AuthShell } from "@/components/auth-shell";
import React from "react";
import { useState } from "react";
import Link from "next/link";
import axios from "axios";
import { AlertCircleIcon, Eye, EyeOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/context/languageContext";

export default function SignUpPage() {
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const router = useRouter();
  const { t } = useLanguage();

  const [savedDraft] = useState<{ fullName?: string; email?: string }>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = sessionStorage.getItem("signup_draft");
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    }
    return {};
  });

  const saveSignupDraft = () => {
    const fullNameInput = document.getElementById("fullName") as HTMLInputElement | null;
    const emailInput = document.getElementById("email") as HTMLInputElement | null;
    sessionStorage.setItem(
      "signup_draft",
      JSON.stringify({
        fullName: fullNameInput?.value ?? "",
        email: emailInput?.value ?? "",
      }),
    );
  };

  const bothAgreed = agreedToTerms && agreedToPrivacy;

  const fields = [
    {
      name: "fullName",
      label: t?.["Login & Sign up"]?.["Full Name"] || "Full Name",
      type: "text",
      minLength: 3,
      maxLength: 20,
      defaultValue: savedDraft.fullName || "",
    },
    { name: "email", label: t?.["Login & Sign up"]?.Email || "Email", type: "email", defaultValue: savedDraft.email || "" },
  ];

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

    if (!agreedToTerms || !agreedToPrivacy) {
      setErrorMessage("You must agree to the Terms of Service and Privacy Policy.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }

    if (fullName.length < 3 || fullName.length > 20) {
      setErrorMessage(
        t?.["Login & Sign up"]?.FullNameLength ??
          "Full name must be between 3 and 20 characters.",
      );
      return;
    }

    try {
      const response = await axios.post("/api/auth/signup", {
        email,
        password,
        fullName,
      });

      if (response.status === 200) {
        sessionStorage.removeItem("signup_draft");
        setSuccessMessage("Sign up successful!");
        setTimeout(() => {
          setSuccessMessage("");
          router.push("/login");
        }, 800);

      }
    } catch (error: any) {
      const backendError = error.response?.data?.error as string | undefined;
      if (backendError?.includes("3 and 20")) {
        setErrorMessage(
          t?.["Login & Sign up"]?.FullNameLength ??
            "Full name must be between 3 and 20 characters.",
        );
        return;
      }
      if (backendError?.toLowerCase().includes("already taken")) {
        setErrorMessage(
          t?.["Login & Sign up"]?.FullNameTaken ??
            "This name is already taken. Please choose another.",
        );
        return;
      }
      setErrorMessage(
        backendError || "Something went wrong. Please try again later.",
      );
    }
  };

  return (
    <div>
      <AuthShell
        title={t?.["Login & Sign up"]?.["Sign up"] || "Sign Up"}
        description={t?.["Login & Sign up"]?.["Create an account to start playing!"] || "Create an account to start playing!"}
        handleSubmit={handleSubmit}
        fields={fields}
        link="/login"
        linkText={t?.["Login & Sign up"]?.["Back to login"] || "Back to login"}
      // submitText="Sign Up"
      >
        {/* Password field with eye icon */}
        <div className="grid gap-2">
          <Label htmlFor="password">{t?.["Login & Sign up"]?.Password || "Password"}</Label>
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

        {/* Terms & Privacy checkboxes */}
        <div className="flex flex-col gap-2">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded-full border accent-primary cursor-pointer shrink-0"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
            />
            <span className="text-xs text-muted-foreground leading-snug">
              {t?.["Login & Sign up"]?.["agree prefix"] || "I agree to the "}
              <Link href="/terms-of-service?from=signup" onClick={saveSignupDraft} className="underline hover:text-foreground">
                {t?.["Login & Sign up"]?.["Terms of Service"] || "Terms of Service"}
              </Link>
              {t?.["Login & Sign up"]?.["agree suffix"] || "."}
            </span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded-full border accent-primary cursor-pointer shrink-0"
              checked={agreedToPrivacy}
              onChange={(e) => setAgreedToPrivacy(e.target.checked)}
            />
            <span className="text-xs text-muted-foreground leading-snug">
              {t?.["Login & Sign up"]?.["agree prefix"] || "I agree to the "}
              <Link href="/privacy-policy?from=signup" onClick={saveSignupDraft} className="underline hover:text-foreground">
                {t?.["Login & Sign up"]?.["Privacy Policy"] || "Privacy Policy"}
              </Link>
              {t?.["Login & Sign up"]?.["agree suffix"] || "."}
            </span>
          </label>
        </div>

        {/* Added Custom Sign Up Button */}
        <div className="mt-4">
          <Button
            className="w-full"
            type="submit"
            disabled={!bothAgreed}
          >
            {t?.["Login & Sign up"]?.["Sign up"] || "Sign Up"}
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
