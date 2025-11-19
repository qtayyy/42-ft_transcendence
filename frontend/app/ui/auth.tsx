"use client";
import axios from "axios";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/shadcn-io/tabs";
import { AlertCircleIcon, Eye, EyeOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useRouter } from "next/navigation";

export function AuthDialog({ text }: { text: string }) {
  const router = useRouter();
  const [tab, setTab] = useState(text === "Sign In" ? "signIn" : "signUp");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetStep, setResetStep] = useState<"email" | "otp" | "password">("email");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [countdown, setCountdown] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  // Countdown timer effect
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

    const email = (data.email || "").toString().trim();
    const password = (data.password || "").toString().trim();
    const fullName = (data.fullName || "").toString().trim();

    if (!email || !password || (tab === "signUp" && !fullName)) {
      setErrorMessage("Please fill in all required fields.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }

    try {
      const endpoint =
        tab === "signIn" ? "/api/auth/login" : "/api/auth/register";
      const response = await axios.post(endpoint, data);
      console.log("Response:", response.data);
      
      if (tab === "signUp" && response.status === 200) {
        setSuccessMessage("Sign up successful!");
        setTimeout(() => {
          setTab("signIn");
          setSuccessMessage("");
          formRef.current?.reset();
        }, 800);
        return;
      }
      
      if (response.status === 200)
        router.push("/dashboard");
      else if (response.status === 202)
          router.push("/2fa/verify");
    } catch (error: any) {
      const backendError = error.response?.data?.error;
      setErrorMessage(backendError || "Something went wrong. Please try again later.");
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (resetStep === "email") {
      // Step 1: Send OTP to email
      if (!resetEmail.trim()) {
        setErrorMessage("Please enter your email address.");
        return;
      }

      try {
        await axios.post("/api/auth/request-reset-otp", { email: resetEmail });
        setSuccessMessage("OTP has been sent to your email!");
        setResetStep("otp");
        setCountdown(60); // Start 60 second countdown
      } catch (error: any) {
        const backendError = error.response?.data?.error;
        setErrorMessage(backendError || "Failed to send OTP. Please try again.");
      }
    } else if (resetStep === "otp") {
      // Step 2: Verify OTP
      if (!otp.trim()) {
        setErrorMessage("Please enter the OTP.");
        return;
      }

      try {
        await axios.post("/api/auth/verify-reset-otp", { 
          email: resetEmail, 
          otp: otp 
        });
        setSuccessMessage("OTP verified! Now enter your new password.");
        setResetStep("password");
      } catch (error: any) {
        const backendError = error.response?.data?.error;
        setErrorMessage(backendError || "Invalid or expired OTP.");
      }
    } else if (resetStep === "password") {
      // Step 3: Reset password
      if (!newPassword || !confirmPassword) {
        setErrorMessage("Please fill in all fields.");
        return;
      }

      if (newPassword.length < 6) {
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
          setShowForgotPassword(false);
          setResetStep("email");
          setResetEmail("");
          setOtp("");
          setNewPassword("");
          setConfirmPassword("");
          setSuccessMessage("");
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
      setErrorMessage(backendError || "Failed to resend OTP. Please try again.");
    }
  };

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          setErrorMessage("");
          setSuccessMessage("");
          setShowPassword(false);
          setShowForgotPassword(false);
          setResetEmail("");
          setResetStep("email");
          setOtp("");
          setNewPassword("");
          setConfirmPassword("");
          setCountdown(0);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="p-5" variant="outline">
          {text}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Sign in or sign up here!</DialogTitle>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(value) => {
            setTab(value);
            setErrorMessage("");
            setSuccessMessage("");
            setShowPassword(false);
            formRef.current?.reset();
          }}
          className="w-[400px] bg-muted rounded-lg mt-4"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signIn">Sign In</TabsTrigger>
            <TabsTrigger value="signUp">Sign Up</TabsTrigger>
          </TabsList>

          <form ref={formRef} onSubmit={handleSubmit}>
            {showForgotPassword ? (
              <TabsContent value="signIn" className="space-y-6 p-6">
                <div className="space-y-3">
                  {resetStep === "email" && (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Enter your email address and we'll send you a 6-digit OTP to reset your password.
                      </p>
                      <div className="space-y-1">
                        <Label htmlFor="resetEmail">Email</Label>
                        <Input
                          type="email"
                          id="resetEmail"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          placeholder="Enter your email"
                        />
                      </div>
                    </>
                  )}

                  {resetStep === "otp" && (
                    <>
                      <p className="text-sm text-muted-foreground">
                        We've sent a 6-digit OTP to <strong>{resetEmail}</strong>
                      </p>
                      <div className="space-y-1">
                        <Label htmlFor="otp">Enter OTP</Label>
                        <Input
                          type="text"
                          id="otp"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                          placeholder="Enter 6-digit OTP"
                          maxLength={6}
                          className="text-center text-2xl tracking-widest"
                        />
                      </div>
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
                          Didn't receive OTP? Resend Code
                        </button>
                      )}
                    </>
                  )}

                  {resetStep === "password" && (
                    <>
                      <p className="text-sm text-muted-foreground">
                        OTP verified! Now enter your new password.
                      </p>
                      <div className="space-y-1">
                        <Label htmlFor="newPassword">New Password</Label>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            id="newPassword"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Enter new password"
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
                      <div className="space-y-1">
                        <Label htmlFor="confirmPassword">Confirm Password</Label>
                        <Input
                          type={showPassword ? "text" : "password"}
                          id="confirmPassword"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm new password"
                        />
                      </div>
                    </>
                  )}
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

                <Button className="w-full" type="button" onClick={handleForgotPassword}>
                  {resetStep === "email" && "Send OTP"}
                  {resetStep === "otp" && "Verify OTP"}
                  {resetStep === "password" && "Reset Password"}
                </Button>
                <Button
                  className="w-full"
                  variant="outline"
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setErrorMessage("");
                    setSuccessMessage("");
                    setResetEmail("");
                    setResetStep("email");
                    setOtp("");
                    setNewPassword("");
                    setConfirmPassword("");
                  }}
                >
                 // Back to Sign In
                </Button>
              </TabsContent>
            ) : tab === "signIn" ? (
              <TabsContent value="signIn" className="space-y-6 p-6">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="email">Email</Label>
                    <Input type="email" id="email" name="email" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input 
                        type={showPassword ? "text" : "password"} 
                        id="password" 
                        name="password"
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
                </div>
                {errorMessage && (
                  <Alert variant="destructive">
                    <AlertCircleIcon className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </Alert>
                )}

                <Button className="w-full" type="submit">
                  Sign In
                </Button>
                <Button className="w-full" type="button">
                  Continue with Google (placeholder)
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(true);
                    setErrorMessage("");
                  }}
                  className="text-sm text-primary hover:underline w-full text-center"
                >
                  Forgot Password?
                </button>
              </TabsContent>
            ) : (
              <TabsContent value="signUp" className="space-y-6 p-6">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input type="text" id="fullName" name="fullName" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="email">Email</Label>
                    <Input type="email" id="email" name="email" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input 
                        type={showPassword ? "text" : "password"} 
                        id="password" 
                        name="password"
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

                <Button className="w-full" type="submit">
                  Sign Up
                </Button>
                <Button className="w-full" type="button">
                  Continue with Google (placeholder)
                </Button>
              </TabsContent>
            )}
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
