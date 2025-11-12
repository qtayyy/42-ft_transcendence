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

export default function SettingsPage() {
  const [error, setError] = useState("");
  const [twoFA, setTwoFA] = useState(false);
  const [qrImage, setQrImage] = useState(null);

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
      </div>
    </div>
  );
}
