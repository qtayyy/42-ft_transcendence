"use client";

import { AlertCircleIcon, Eye, EyeOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@radix-ui/react-label";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const [error, setError] = useState("");
  const [twoFA, setTwoFA] = useState(false);
  const [qrImage, setQrImage] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordChangeStep, setPasswordChangeStep] = useState<"input" | "otp" | "success">("input");
  const [otp, setOtp] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [countdown, setCountdown] = useState(0);
  const router = useRouter();

  // Countdown timer effect
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    async function get2FA() {
      try {
        setError("");
        const response = await axios.get("/api/2fa");
        const twoFAStatus = response.data;
        console.log(`twoFAStatus is ${twoFAStatus}`);
        setTwoFA(twoFAStatus);
        
        // Get user email for password reset OTP
        const profileResponse = await axios.get("/api/profile");
        setUserEmail(profileResponse.data.email || "");
      } catch (error: any) {
        const backendError = error.response.data.error;
        setError(
          backendError || "Something went wrong. Please try again later."
        );
      }
    }
    get2FA();
  }, []);

  const handleSwitch = async (checked: boolean) => {
    setTwoFA(checked);
    setError("");

    try {
      const endpoint = checked === true ? "api/2fa/enable" : "api/2fa/disable";
      const res = await axios.get(endpoint);

      if (checked) {
        setQrImage(res.data.imageUrl);
        alert("2FA successfully enabled!");
      } else {
        setQrImage(null);
        alert("2FA successfully disabled!");
      }
    } catch (error: any) {
      const backendError = error.response.data.error;
      setError(backendError || "Something went wrong. Please try again later.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (passwordChangeStep === "input") {
      // Step 1: Validate passwords and send OTP
      if (!oldPassword || !newPassword) {
        setError("Please provide your current password and a new password.");
        return;
      }

      if (newPassword.length < 6) {
        setError("New password must be at least 6 characters long.");
        return;
      }

      try {
        // Send OTP to user's email
        await axios.post("/api/auth/request-reset-otp", { email: userEmail });
        setPasswordChangeStep("otp");
        setCountdown(60);
        setError("");
      } catch (error: any) {
        const backendError = error.response?.data?.error;
        setError(backendError || "Failed to send OTP. Please try again.");
      }
    } else if (passwordChangeStep === "otp") {
      // Step 2: Verify OTP and change password
      if (!otp.trim()) {
        setError("Please enter the OTP sent to your email.");
        return;
      }

      try {
        // Verify OTP
        await axios.post("/api/auth/verify-reset-otp", { 
          email: userEmail, 
          otp: otp 
        });

        // Change password using the old password verification
        await axios.post("/api/auth/password", {
          oldPassword: oldPassword,
          newPassword: newPassword
        });

        alert("Password changed successfully!");
        setPasswordChangeStep("input");
        setShowPasswordFields(false);
        setOldPassword("");
        setNewPassword("");
        setOtp("");
        setError("");
      } catch (error: any) {
        const backendError = error.response?.data?.error;
        setError(backendError || "Invalid OTP or failed to change password.");
      }
    }
  };

  const handleResendOTP = async () => {
    setError("");

    try {
      await axios.post("/api/auth/request-reset-otp", { email: userEmail });
      setCountdown(60);
      alert("OTP has been resent to your email!");
    } catch (error: any) {
      const backendError = error.response?.data?.error;
      setError(backendError || "Failed to resend OTP. Please try again.");
    }
  };

  const handleCancelPasswordChange = () => {
    setShowPasswordFields(false);
    setPasswordChangeStep("input");
    setOldPassword("");
    setNewPassword("");
    setOtp("");
    setError("");
    setCountdown(0);
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword.trim()) {
      setDeleteError("Please enter your password to confirm deletion.");
      return;
    }

    setIsDeleting(true);
    setDeleteError("");

    try {
      await axios.delete("/api/profile", {
        data: { password: deletePassword }
      });
      alert("Account deleted successfully. You will be redirected to the home page.");
      setDeleteDialogOpen(false);
      setDeletePassword("");
      router.push("/");
    } catch (error: any) {
      const backendError = error.response?.data?.error;
      setDeleteError(backendError || "Failed to delete account. Please check your password.");
      setIsDeleting(false);
    }
  };

  return (
    <div className="h-screen bg-accent m-2 p-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex justify-between">
        <p className="text-2xl font-semibold p-5">SETTINGS</p>
      </div>
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-5 mx-5">
          {/* Left Column - Main Settings */}
          <div className="lg:col-span-2 space-y-8">
            <div>
              <p className="text-xl font-semibold">Two-factor authentication (2FA)</p>
              <div className="flex gap-4 items-center mt-4">
                <Switch
                  id="twoFA"
                  checked={twoFA}
                  onCheckedChange={handleSwitch}
                  className="bg-gray-400"
                />
                <Label htmlFor="twoFA">
                  {twoFA ? "2FA Enabled" : "2FA Disabled"}
                </Label>
              </div>
              {qrImage ? (
                <div className="mt-4">
                  <p className="mb-2 text-gray-200">
                    Scan this QR code with your authenticator app:
                  </p>
                  <Image
                    src={qrImage}
                    alt="2FA QR Code"
                    width={192}
                    height={192}
                    className="my-4"
                  />
                </div>
              ) : null}
            </div>
            
            <div className="pt-12">
              <p className="text-xl font-semibold mb-4">Change password</p>
            
              <form onSubmit={handleSubmit} className="grid gap-5">
                {passwordChangeStep === "input" && (
                  <>
                    <div className="grid gap-3">
                      <Label htmlFor="oldPassword">Current password</Label>
                      <div className="relative w-full md:w-3/4">
                        <Input
                          type={showOldPassword ? "text" : "password"}
                          id="oldPassword"
                          value={oldPassword}
                          onChange={(e) => setOldPassword(e.target.value)}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowOldPassword(!showOldPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showOldPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="grid gap-3">
                      <Label htmlFor="newPassword">New password</Label>
                      <div className="relative w-full md:w-3/4">
                        <Input
                          type={showNewPassword ? "text" : "password"}
                          id="newPassword"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showNewPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {passwordChangeStep === "otp" && (
                  <div className="grid gap-3">
                    <p className="text-sm text-muted-foreground">
                      We've sent a 6-digit OTP to <strong>{userEmail}</strong>
                    </p>
                    <Label htmlFor="otp">Enter OTP</Label>
                    <Input
                      type="text"
                      id="otp"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="Enter 6-digit OTP"
                      maxLength={6}
                      className="w-full md:w-3/4 text-center text-2xl tracking-widest"
                    />
                    {countdown > 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Resend OTP in <strong>{countdown}s</strong>
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendOTP}
                        className="text-sm text-primary hover:underline text-left"
                      >
                        Didn't receive OTP? Resend Code
                      </button>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button type="submit" className="w-auto">
                    {passwordChangeStep === "input" ? "Save" : "Verify & Change Password"}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCancelPasswordChange} className="w-auto">
                    Cancel
                  </Button>
                </div>
              </form>
          </div>

        </div>

        {/* Right Column - Danger Zone */}
        <div className="lg:col-span-1">
          <div className="border border-destructive/50 rounded-lg p-6 bg-destructive/5">
            <p className="text-xl font-semibold text-destructive mb-2">Danger Zone</p>
            <p className="text-lg font-medium mb-4">Delete Profile</p>
            <p className="text-sm text-muted-foreground mb-4">
              Once you delete your account, there is no going back. This action is irreversible.
            </p>
            <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
              setDeleteDialogOpen(open);
              if (!open) {
                setDeletePassword("");
                setDeleteError("");
              }
            }}>
              <DialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  Delete Account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Are you sure you want to delete your account?</DialogTitle>
                  <DialogDescription>
                    This action will permanently delete your account and all associated data including:
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    <li>Your profile information</li>
                    <li>Your email address</li>
                    <li>All your friends</li>
                    <li>All your tournament history</li>
                    <li>All your match records</li>
                  </ul>
                  <p className="text-sm font-semibold text-destructive">
                    This action is irreversible and cannot be undone.
                  </p>
                  <div className="space-y-2 pt-2">
                    <Label htmlFor="deletePassword">Enter your password to confirm</Label>
                    <Input
                      id="deletePassword"
                      type="password"
                      placeholder="Enter your password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      disabled={isDeleting}
                    />
                    {deleteError && (
                      <p className="text-sm text-destructive">{deleteError}</p>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDeleteDialogOpen(false);
                      setDeletePassword("");
                      setDeleteError("");
                    }}
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={isDeleting || !deletePassword.trim()}
                  >
                    {isDeleting ? "Deleting..." : "Yes, Delete My Account"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
