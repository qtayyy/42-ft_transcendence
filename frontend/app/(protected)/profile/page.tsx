"use client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@radix-ui/react-label";
import axios from "axios";
import React, { useEffect, useState } from "react";
import { AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/context/languageContext";


export default function ProfilePage() {
  const { refreshUser } = useAuth();
  const { t } = useLanguage();
  const [profile, setProfile] = useState({
    email: "",
    username: "",
    dob: "",
    region: "",
  });
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<File | string | null>(null);
  const [error, setError] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [originalProfile, setOriginalProfile] = useState({
    email: "",
    username: "",
    dob: "",
    region: "",
  });
  const [originalAvatar, setOriginalAvatar] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    async function getProfile() {
      try {
        setError("");
        const profileData = {
          email: user?.email || "",
          username: user?.username || "",
          dob: user?.dob ? new Date(user?.dob).toISOString().split("T")[0] : "",
          region: user?.region || "",
        };
        setProfile(profileData);
        setOriginalProfile(profileData);
        setPreview(user?.avatar || null);
        setOriginalAvatar(user?.avatar || null);
      } catch (error: any) {
        const backendError = error.response?.data?.error;
        setError(
          backendError || "Something went wrong. Please try again later."
        );
      }
    }
    getProfile();
  }, [user]);

  async function handleAvatarChange(e) {
    if (!isEditMode) return;
    const file = e.target.files[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);
    setSelectedAvatar(file);
  }

  async function handleDeleteAvatar() {
    if (!isEditMode) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete your profile picture?"
    );

    if (!confirmed) return;

    setPreview(null);
    setSelectedAvatar("DELETE");
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!isEditMode) return;
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  }

  function handleEdit() {
    setIsEditMode(true);
  }

  function handleCancel() {
    setIsEditMode(false);
    setProfile(originalProfile);
    setPreview(originalAvatar);
    setSelectedAvatar(null);
    setError("");
  }

  async function handleSave() {
    try {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (profile.email && !emailRegex.test(profile.email)) {
        setError("Please enter a valid email address (e.g., example@domain.com)");
        return;
      }

      const formData = new FormData();

      // If avatar was marked for deletion
      if (selectedAvatar === "DELETE") {
        formData.append("deleteAvatar", "true");
      }
      // If new avatar was selected
      else if (selectedAvatar) {
        formData.append("avatar", selectedAvatar);
      }

      // Append all profile fields
      Object.keys(profile).forEach((key) => {
        formData.append(key, profile[key]);
      });

      setError("");

      await axios.put("/api/profile", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setSelectedAvatar(null);
      setIsEditMode(false);

      try {
        const updatedProfile = await refreshUser();
        const profileData = {
          email: updatedProfile?.email || "",
          username: updatedProfile?.username || "",
          dob: updatedProfile?.dob ? new Date(updatedProfile?.dob).toISOString().split("T")[0] : "",
          region: updatedProfile?.region || "",
        };
        setProfile(profileData);
        setOriginalProfile(profileData);
        setPreview(updatedProfile?.avatar || null);
        setOriginalAvatar(updatedProfile?.avatar || null);

      } catch (refreshError) {
        console.error("Error refreshing profile:", refreshError);
        // Profile was saved, just couldn't refresh - reload the page
        window.location.reload();
      }

      alert("Profile saved");
    } catch (error: any) {
      const backendError = error.response?.data?.error;
      setError(backendError || "Something went wrong. Please try again later.");
    }
  }

  return (
    <div className="bg-accent m-2 p-6 rounded-lg">
      {error && (
        <Alert variant="destructive">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex justify-between">
        <p className="text-2xl font-semibold p-5">{t?.DropDown?.Profile?.toUpperCase() || "PROFILE"}</p>
        <div className="m-5 flex gap-2">
          {isEditMode ? (
            <>
              <Button variant="outline" onClick={handleCancel}>
                {t?.Profile?.Cancel || "Cancel"}
              </Button>
              <Button variant="default" onClick={handleSave}>
                {t?.Profile?.Save || "Save"}
              </Button>
            </>
          ) : (
            <Button variant="default" onClick={handleEdit}>
              {t?.Profile?.Edit || "Edit"}
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
        <div className="relative">
          <Avatar className="h-48 w-48 border-2 mx-5">
            <AvatarImage
              src={preview || undefined}
              alt="Profile"
              onError={() => setPreview(null)}
            />
            <AvatarFallback className="text-4xl">
              {profile.username ? profile.username[0].toUpperCase() : "?"}
            </AvatarFallback>
          </Avatar>
          {isEditMode && (
            <>
              <Label
                htmlFor="avatar"
                className="absolute right-10 bottom-3 h-10 w-10 rounded-full flex items-center justify-center bg-primary/90 text-white cursor-pointer shadow-md hover:bg-primary"
              >
                <Camera />
              </Label>
              {preview && (
                <button
                  onClick={handleDeleteAvatar}
                  className="absolute left-10 bottom-3 h-10 w-10 rounded-full flex items-center justify-center bg-destructive/90 text-white cursor-pointer shadow-md hover:bg-destructive"
                  type="button"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              )}
            </>
          )}
          <Input
            type="file"
            id="avatar"
            name="avatar"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
            disabled={!isEditMode}
          ></Input>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2 mt-8 mx-5">
        <div className="grid gap-3">
          <Label htmlFor="email">{t?.["Login & Sign up"]?.Email || "Email"}</Label>
          <Input
            type="email"
            id="email"
            name="email"
            value={profile.email}
            onChange={handleInputChange}
            disabled={!isEditMode}
          />
        </div>
        <div className="grid gap-3">
          <Label htmlFor="username">{t?.Profile?.Username || "Username"}</Label>
          <Input
            type="text"
            id="username"
            name="username"
            value={profile.username}
            onChange={handleInputChange}
            disabled={!isEditMode}
          />
        </div>
        <div className="grid gap-3">
          <Label htmlFor="dob">{t?.Profile?.DateofBirth || "Date of Birth"}</Label>
          <Input
            type="date"
            id="dob"
            name="dob"
            value={profile.dob}
            onChange={handleInputChange}
            disabled={!isEditMode}
          />
        </div>
        <div className="grid gap-3">
          <Label htmlFor="region">{t?.Profile?.["Country/Region"] || "Country/Region"}</Label>
          <Input
            type="text"
            id="region"
            name="region"
            value={profile.region}
            onChange={handleInputChange}
            disabled={!isEditMode}
          />
        </div>
      </div>
    </div>
  );
}
