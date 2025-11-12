"use client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@radix-ui/react-label";
import axios from "axios";
import React, { useEffect, useState } from "react";
import { AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function ProfilePage() {
  const [profile, setProfile] = useState({
    username: "",
    fullname: "",
    dob: "",
    region: "",
  });
  // Stores blob URL/upload URL to display avatar preview
  const [preview, setPreview] = useState("");
  // Stores chosen avatar file to be sent to backend
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function getProfile() {
      try {
        setError("");
        const { data } = await axios.get("/api/profile");
        setProfile({
          username: data.username || "",
          fullname: data.fullname || "",
          dob: data.dob ? new Date(data.dob).toISOString().split("T")[0] : "",
          region: data.region || "",
        });
        setPreview(data.avatar || "");
      } catch (error: any) {
        const backendError = error.response.data.error;
        setError(
          backendError || "Something went wrong. Please try again later."
        );
      }
    }
    getProfile();
  }, []);

  async function handleAvatarChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    // Create a temporary local URL (called a blob URL) that the browser can read
    // from directly before the image is saved to backend.
    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);
    setSelectedAvatar(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSave() {
    try {
      // https://developer.mozilla.org/en-US/docs/Web/API/FormData
      const formData = new FormData();

      // Append avatar if selected
      if (selectedAvatar) formData.append("avatar", selectedAvatar);

      // Append all profile fields
      Object.keys(profile).forEach((key) => {
        formData.append(key, profile[key]);
      });

      setError("");

      await axios.put("/api/profile", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setSelectedAvatar(null);
      alert("Profile saved");
    } catch (error: any) {
      const backendError = error.response.data.error;
      setError(backendError || "Something went wrong. Please try again later.");
    }
  }

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
        <p className="text-2xl font-semibold p-5">PROFILE</p>
        <Button className="m-5" variant="default" onClick={handleSave}>
          Save
        </Button>
      </div>
      <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
        <div className="relative">
          <Avatar className="h-48 w-48 border-2 mx-5">
            <AvatarImage
              src={preview || ""}
              alt="Profile"
              onError={() => setPreview("")}
            />
            <AvatarFallback className="text-2xl">
              {profile.username ? profile.username[0].toUpperCase() : "?"}
            </AvatarFallback>
          </Avatar>
          <Label
            htmlFor="avatar"
            className="absolute right-10 bottom-3 h-10 w-10 rounded-full flex items-center justify-center bg-primary/90 text-white cursor-pointer shadow-md hover:bg-primary"
          >
            <Camera />
          </Label>
          <Input
            type="file"
            id="avatar"
            name="avatar"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          ></Input>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2 mt-8 mx-5">
        <div className="grid gap-3">
          <Label htmlFor="username">Username</Label>
          <Input
            type="text"
            id="username"
            name="username"
            value={profile.username}
            onChange={handleInputChange}
          />
        </div>
        <div className="grid gap-3">
          <Label htmlFor="fullname">Full Name</Label>
          <Input
            type="text"
            id="fullname"
            name="fullname"
            value={profile.fullname}
            onChange={handleInputChange}
          />
        </div>
        <div className="grid gap-3">
          <Label htmlFor="dob">Date of Birth</Label>
          <Input
            type="date"
            id="dob"
            name="dob"
            value={profile.dob}
            onChange={handleInputChange}
          />
        </div>
        <div className="grid gap-3">
          <Label htmlFor="region">Country/Region</Label>
          <Input
            type="text"
            id="region"
            name="region"
            value={profile.region}
            onChange={handleInputChange}
          />
        </div>
      </div>
    </div>
  );
}
