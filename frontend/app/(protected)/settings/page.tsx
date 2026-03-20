"use client";

import { AlertCircleIcon, Eye, EyeOff, Shield, Lock, Trash2, Settings as SettingsIcon, KeyRound, UserX, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@radix-ui/react-label";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import Image from "next/image";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/context/languageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [twoFA, setTwoFA] = useState(false);
  const [qrImage, setQrImage] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordChangeStep, setPasswordChangeStep] = useState<
    "input" | "otp" | "success"
  >("input");
  const [otp, setOtp] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [twoFAStep, setTwoFAStep] = useState<"disable" | "enable" | "verify">(
    "disable"
  );
  const [twoFADialogOpen, setTwoFADialogOpen] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();

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
        setTwoFA(twoFAStatus);

        // Get user email for password reset OTP
        // const profileResponse = await axios.get("/api/profile");
        setUserEmail(user?.email || "");
      } catch (error: any) {
        const backendError = error.response.data.error;
        setError(
          backendError || "Something went wrong. Please try again later."
        );
      }
    }
    get2FA();
  }, []);

  // Fetch blocked users
  useEffect(() => {
    fetchBlockedUsers();
  }, []);

  const fetchBlockedUsers = async () => {
    try {
      setLoadingBlocked(true);
      const response = await axios.get("/api/chat/block");
      setBlockedUsers(response.data);
    } catch (error: any) {
      console.error("Error fetching blocked users:", error);
    } finally {
      setLoadingBlocked(false);
    }
  };

  const handleUnblock = async (userId: string) => {
    try {
      await axios.delete(`/api/chat/block/${userId}`);
      setSuccess("User unblocked successfully");
      setError("");
      // Remove from local state
      setBlockedUsers(blockedUsers.filter((user) => user.id !== userId));
      setTimeout(() => setSuccess(""), 3000);
    } catch (error: any) {
      const backendError = error.response?.data?.error;
      setError(backendError || "Failed to unblock user");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleSwitch = async (checked: boolean) => {
    setTwoFA(checked);
    setError("");

    try {
      const endpoint = checked === true ? "api/2fa/enable" : "api/2fa/disable";
      const res = await axios.get(endpoint);

      if (checked) {
        setTwoFAStep("enable");
        setTwoFADialogOpen(true);
        setQrImage(res.data.imageUrl);
      } else {
        setQrImage(null);
        setTwoFAStep("disable");
        setSuccess("2FA successfully disabled!");
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
          otp: otp,
        });

        // Change password using the old password verification
        await axios.post("/api/auth/password", {
          oldPassword: oldPassword,
          newPassword: newPassword,
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
        data: { password: deletePassword },
      });
      alert(
        "Account deleted successfully. You will be redirected to the home page."
      );
      setDeleteDialogOpen(false);
      setDeletePassword("");
      router.push("/");
    } catch (error: any) {
      const backendError = error.response?.data?.error;
      setDeleteError(
        backendError || "Failed to delete account. Please check your password."
      );
      setIsDeleting(false);
    }
  };

  const enableTwoFA = async (e: React.FormEvent) => {
    try {
      e.preventDefault();
      setError("");
      setSuccess("");
      const form = e.target as HTMLFormElement;
      const data = Object.fromEntries(new FormData(form).entries());
      const response = await axios.post("/api/auth/2fa/enable/verify", data);
      if (response.status === 200) {
        setTwoFADialogOpen(false);
        setSuccess("2FA successfully enabled!");
      }
    } catch (error: any) {
      const backendError = error.response?.data?.error;
      setError(backendError || "Something went wrong. Please try again later.");
    }
  };

  const revertTwoFA = async () => {
    try {
      setError("");
      setSuccess("");
      await axios.get("/api/2fa/disable");
    } catch (error: any) {
      const backendError = error.response?.data?.error;
      setError(backendError || "Something went wrong. Please try again later.");
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-gradient-to-b from-background to-muted/20">
      <div className="w-full max-w-7xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Header Section */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl md:text-6xl font-black tracking-tighter bg-gradient-to-r from-white via-primary/50 to-white bg-clip-text text-transparent pb-2">
            {t?.DropDown?.Settings || "Settings"}
          </h1>
          <p className="text-xl text-muted-foreground font-medium max-w-2xl mx-auto">
            Manage your account security and preferences
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <Alert variant="destructive" className="max-w-3xl mx-auto">
            <AlertCircleIcon className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="bg-green-500/10 border-green-500/50 text-green-600 dark:text-green-400 max-w-3xl mx-auto">
            <AlertCircleIcon className="h-4 w-4" />
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Left Column - Security Settings */}
          <div className="lg:col-span-2 space-y-6">
            {/* 2FA Card */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl blur opacity-20 group-hover:opacity-75 transition duration-500"></div>
              <Card className="relative border-0 bg-card/95 backdrop-blur-sm overflow-hidden transition-all hover:scale-[1.01]">
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Shield className="h-32 w-32 -mr-8 -mt-8" />
                </div>
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                      <Shield className="h-8 w-8 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-2xl mb-2">
                        {t?.Setting?.["Two-factor authentication (2FA)"] || "Two-factor authentication (2FA)"}
                      </CardTitle>
                      <CardDescription className="text-base">
                        Add an extra layer of security to your account
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 items-center p-4 bg-muted/30 rounded-lg border border-border/50">
                    <Switch
                      id="twoFA"
                      checked={twoFA}
                      onCheckedChange={handleSwitch}
                    />
                    <Label htmlFor="twoFA" className="font-medium cursor-pointer">
                      {twoFA ? (t?.Setting?.["2FAEnable"] || "2FA Enabled") : (t?.Setting?.["2FADisable"] || "2FA Disabled")}
                    </Label>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 2FA Dialogs */}
            {qrImage && twoFAStep === "enable" ? (
                <Dialog
                  open={twoFADialogOpen}
                  onOpenChange={(open) => {
                    if (!open) {
                      setTwoFA(false);
                      setTwoFAStep("disable");
                      revertTwoFA();
                    }
                    setTwoFADialogOpen(open);
                  }}
                >
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Enable 2FA</DialogTitle>
                      <DialogDescription>
                        Scan this QR code with your authenticator app:
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid place-items-center">
                      <Image
                        src={qrImage}
                        alt="2FA QR Code"
                        width={192}
                        height={192}
                        className="my-4"
                      />
                    </div>
                    <div className="grid justify-end">
                      <Button
                        className="w-40"
                        variant="default"
                        onClick={() => {
                          setTwoFAStep("verify");
                        }}
                      >
                        Next
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              ) : twoFAStep === "verify" ? (
                <Dialog
                  open={twoFADialogOpen}
                  onOpenChange={(open) => {
                    if (!open) {
                      setTwoFA(false);
                      setTwoFAStep("disable");
                      revertTwoFA();
                    }
                    setTwoFADialogOpen(open);
                  }}
                >
                  <DialogContent>
                    <form onSubmit={enableTwoFA}>
                      <DialogHeader>
                        <DialogTitle>Enable 2FA</DialogTitle>
                        <DialogDescription>
                          Enter your OTP from your Google Auth app
                        </DialogDescription>
                        {error && (
                          <Alert variant="destructive">
                            <AlertCircleIcon className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                          </Alert>
                        )}
                        <Label className="mt-3" htmlFor="code">
                          OTP
                        </Label>
                        <Input
                          className="mb-8"
                          type="number"
                          id="code"
                          name="code"
                          required
                        ></Input>
                      </DialogHeader>

                      <div className="grid justify-end">
                        <Button
                          className="w-40"
                          variant="default"
                          type="submit"
                        >
                          Finish
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              ) : null}

            {/* Password Change Card */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl blur opacity-20 group-hover:opacity-75 transition duration-500"></div>
              <Card className="relative border-0 bg-card/95 backdrop-blur-sm overflow-hidden transition-all hover:scale-[1.01]">
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                  <KeyRound className="h-32 w-32 -mr-8 -mt-8" />
                </div>
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                      <Lock className="h-8 w-8 text-purple-500" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-2xl mb-2">
                        {t?.Setting?.ChangePassword || "Change Password"}
                      </CardTitle>
                      <CardDescription className="text-base">
                        Update your account password
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {passwordChangeStep === "input" && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="oldPassword" className="text-base">
                            {t?.Setting?.CurrentPassword || "Current password"}
                          </Label>
                          <div className="relative">
                            <Input
                              type={showOldPassword ? "text" : "password"}
                              id="oldPassword"
                              value={oldPassword}
                              onChange={(e) => setOldPassword(e.target.value)}
                              className="pr-10 bg-muted/30 border-border/50"
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
                        <div className="space-y-2">
                          <Label htmlFor="newPassword" className="text-base">
                            {t?.Setting?.NewPassword || "New password"}
                          </Label>
                          <div className="relative">
                            <Input
                              type={showNewPassword ? "text" : "password"}
                              id="newPassword"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="pr-10 bg-muted/30 border-border/50"
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
                      </div>
                    )}

                    {passwordChangeStep === "otp" && (
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground p-4 bg-muted/30 rounded-lg border border-border/50">
                          We&apos;ve sent a 6-digit OTP to{" "}
                          <strong className="text-foreground">{userEmail}</strong>
                        </p>
                        <div className="space-y-2">
                          <Label htmlFor="otp" className="text-base">Enter OTP</Label>
                          <Input
                            type="text"
                            id="otp"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            placeholder="Enter 6-digit OTP"
                            maxLength={6}
                            className="text-center text-2xl tracking-widest bg-muted/30 border-border/50"
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
                            Didn&apos;t receive OTP? Resend Code
                          </button>
                        )}
                      </div>
                    )}

                    <div className="flex gap-3 pt-2">
                      <Button type="submit" className="flex-1">
                        {passwordChangeStep === "input"
                          ? (t?.Setting?.Save || "Save")
                          : "Verify & Change Password"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCancelPasswordChange}
                        className="flex-1"
                      >
                        {t?.Setting?.Cancel || "Cancel"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Blocked Users Card */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl blur opacity-20 group-hover:opacity-75 transition duration-500"></div>
              <Card className="relative border-0 bg-card/95 backdrop-blur-sm overflow-hidden transition-all hover:scale-[1.01]">
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                  <UserX className="h-32 w-32 -mr-8 -mt-8" />
                </div>
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                      <UserX className="h-8 w-8 text-purple-500" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-2xl mb-2">
                        {t?.Setting?.["Blocked Users"] || "Blocked Users"}
                      </CardTitle>
                      <CardDescription className="text-base">
                        Manage users you have blocked
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingBlocked ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : blockedUsers.length === 0 ? (
                    <div className="text-center py-8 px-4 bg-muted/30 rounded-lg border border-border/50">
                      <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">
                        {t?.Setting?.["No blocked users"] || "No blocked users"}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {blockedUsers.map((blockedUser) => (
                        <div
                          key={blockedUser.id}
                          className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
                        >
                          <Avatar className="h-10 w-10">
                            {blockedUser.avatar && (
                              <AvatarImage src={blockedUser.avatar} alt={blockedUser.username} />
                            )}
                            <AvatarFallback>
                              {blockedUser.username?.[0]?.toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {blockedUser.username}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Blocked {new Date(blockedUser.blockedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUnblock(blockedUser.id)}
                            className="hover:bg-primary hover:text-primary-foreground transition-colors"
                          >
                            Unblock
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Right Column - Danger Zone */}
          <div className="lg:col-span-1">
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl blur opacity-30 group-hover:opacity-100 transition duration-500"></div>
              <Card className="relative border-0 bg-card/95 backdrop-blur-sm overflow-hidden transition-all hover:scale-[1.01]">
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Trash2 className="h-32 w-32 -mr-8 -mt-8" />
                </div>
                <CardHeader>
                  <div className="p-3 rounded-xl bg-red-500/10 group-hover:bg-red-500/20 transition-colors inline-block mb-3">
                    <Trash2 className="h-8 w-8 text-red-500" />
                  </div>
                  <CardTitle className="text-2xl text-destructive">
                    {t?.Setting?.DangerZone || "Danger Zone"}
                  </CardTitle>
                  <CardDescription className="text-base">
                    {t?.Setting?.DeleteProfile || "Delete Profile"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {t?.Setting?.["Once you delete your account, there is no going back. This action is irreversible."] || "Once you delete your account, there is no going back. This action is irreversible."}
                  </p>
                  <Dialog
                    open={deleteDialogOpen}
                    onOpenChange={(open) => {
                      setDeleteDialogOpen(open);
                      if (!open) {
                        setDeletePassword("");
                        setDeleteError("");
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button variant="destructive" className="w-full hover:scale-[1.02] transition-all">
                        {t?.Setting?.["DeleteAccount "] || "Delete Account"}
                      </Button>
                    </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {t?.Setting?.["Are you sure you want to delete your account?"] || "Are you sure you want to delete your account?"}
                    </DialogTitle>
                    <DialogDescription>
                      {t?.Setting?.["This action will permanently delete your account and all associated data including: "] || "This action will permanently delete your account and all associated data including:"}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      <li>{t?.Setting?.["Your profile information"] || "Your profile information"}</li>
                      <li>{t?.Setting?.["Your email address"] || "Your email address"}</li>
                      <li>{t?.Setting?.["All your friends"] || "All your friends"}</li>
                      <li>{t?.Setting?.["All your tournaments history"] || "All your tournament history"}</li>
                      <li>{t?.Setting?.["All your match records"] || "All your match records"}</li>
                    </ul>
                    <p className="text-sm font-semibold text-destructive">
                      {t?.Setting?.["This action is irreversible and cannot be undone."] || "This action is irreversible and cannot be undone."}
                    </p>
                    <div className="space-y-2 pt-2">
                      <Label htmlFor="deletePassword">
                        {t?.Setting?.["Enter your password to confirm"] || "Enter your password to confirm"}
                      </Label>
                      <Input
                        id="deletePassword"
                        type="password"
                        placeholder={t?.Setting?.["Enter your password"] || "Enter your password"}
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        disabled={isDeleting}
                      />
                      {deleteError && (
                        <p className="text-sm text-destructive">
                          {deleteError}
                        </p>
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
                      {t?.Setting?.Cancel || "Cancel"}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleDeleteAccount}
                      disabled={isDeleting || !deletePassword.trim()}
                    >
                      {isDeleting ? "Deleting..." : (t?.Setting?.["Yes,Delete My Account"] || "Yes, Delete My Account")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
