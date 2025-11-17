"use client";

import { AlertCircleIcon } from "lucide-react";
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
  const router = useRouter();

  useEffect(() => {
    async function get2FA() {
      try {
        setError("");
        const response = await axios.get("/api/2fa");
        const twoFAStatus = response.data;
        console.log(`twoFAStatus is ${twoFAStatus}`);
        setTwoFA(twoFAStatus);
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
    const form = e.target;
    const data = Object.fromEntries(new FormData(form).entries());

    setError("");

    if (!data.newPassword || !data.oldPassword) {
      setError("Please provide your old password and a new password.");
      return;
    }

    try {
      await axios.post("/api/auth/password", data);
      alert("Password changed successfully!");
    } catch (error: any) {
      const backendError = error.response?.data?.error;
      setError(backendError || "Something went wrong. Please try again later.");
    } finally {
      form.reset();
    }
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
      <div className="grid grid-cols-1 gap-8 mt-5 mx-5">
        <p className="text-xl font-semibold">Change password</p>
        <form onSubmit={handleSubmit} className="grid gap-5">
          <div className="grid gap-3">
            <Label htmlFor="oldPassword">Old password</Label>
            <Input
              type="password"
              id="oldPassword"
              name="oldPassword"
              className="w-1/2"
            />
          </div>
          <div className="grid gap-3">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              type="password"
              id="newPassword"
              name="newPassword"
              className="w-1/2"
            />
          </div>
          <Button type="submit" className="w-20">
            Confirm
          </Button>
        </form>
        <p className="text-xl font-semibold">Two-factor authentication (2FA)</p>
        <div className="flex gap-4 items-center">
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
          <div>
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
        
        {/* Delete Profile Section */}
        <div className="border-t pt-8 mt-8">
          <p className="text-xl font-semibold text-destructive mb-4">Delete Profile</p>
          <p className="text-muted-foreground mb-4">
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
              <Button variant="destructive" className="w-auto">
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
  );
}
