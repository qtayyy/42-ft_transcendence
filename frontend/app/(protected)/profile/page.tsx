"use client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Trash2, User, Mail, Calendar, MapPin, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@radix-ui/react-label";
import { Card, CardContent } from "@/components/ui/card";
import axios from "axios";
import React, { useEffect, useRef, useState } from "react";
import { AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/context/languageContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


export default function ProfilePage() {
  const { refreshUser } = useAuth();
  const { t } = useLanguage();
  const [profile, setProfile] = useState({
    email: "",
    username: "",
    dob: "",
    region: "",
    bio: "",
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
    bio: "",
  });
  const [originalAvatar, setOriginalAvatar] = useState<string | null>(null);
  const [deleteAvatarDialogOpen, setDeleteAvatarDialogOpen] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  function revokePreviewIfBlob(url: string | null) {
    if (url?.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
  }

  useEffect(() => {
    async function getProfile() {
      try {
        setError("");
        const profileData = {
          email: user?.email || "",
          username: user?.username || "",
          dob: user?.dob ? new Date(user?.dob).toISOString().split("T")[0] : "",
          region: user?.region || "",
          bio: user?.bio || "",
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

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!isEditMode) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview((prev) => {
      revokePreviewIfBlob(prev);
      return URL.createObjectURL(file);
    });
    setSelectedAvatar(file);
  }

  function handleDeleteAvatarClick() {
    if (!isEditMode) return;
    setDeleteAvatarDialogOpen(true);
  }

  function confirmDeleteAvatar() {
    setPreview((prev) => {
      revokePreviewIfBlob(prev);
      return null;
    });
    setSelectedAvatar("DELETE");
    setDeleteAvatarDialogOpen(false);
    if (avatarInputRef.current) {
      avatarInputRef.current.value = "";
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (!isEditMode) return;
    const { name, value } = e.target;
    if (name === "username") {
      setError("");
    }
    setProfile((prev) => ({ ...prev, [name]: value }));
  }

  function handleEdit() {
    setIsEditMode(true);
  }

  function handleCancel() {
    setIsEditMode(false);
    setProfile(originalProfile);
    revokePreviewIfBlob(preview);
    setPreview(originalAvatar);
    setSelectedAvatar(null);
    setError("");
    // Reset file input so choosing the same file again fires `change` (browser quirk).
    if (avatarInputRef.current) {
      avatarInputRef.current.value = "";
    }
  }

  async function handleSave() {
    const trimmedUsername = profile.username.trim();
    if (!trimmedUsername) {
      setError(t?.Profile?.UsernameRequired ?? "Username cannot be empty.");
      return;
    }

    try {
      const formData = new FormData();

      // If avatar was marked for deletion
      if (selectedAvatar === "DELETE") {
        formData.append("deleteAvatar", "true");
      }
      // If new avatar was selected
      else if (selectedAvatar) {
        formData.append("avatar", selectedAvatar);
      }

      const profilePayload = { ...profile, username: trimmedUsername };

      // Append all profile fields
      Object.keys(profilePayload).forEach((key) => {
        formData.append(key, profilePayload[key]);
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
          bio: updatedProfile?.bio || "",
        };
        setProfile(profileData);
        setOriginalProfile(profileData);
        setPreview((prev) => {
          revokePreviewIfBlob(prev);
          return updatedProfile?.avatar || null;
        });
        setOriginalAvatar(updatedProfile?.avatar || null);
        if (avatarInputRef.current) {
          avatarInputRef.current.value = "";
        }

      } catch (refreshError) {
        console.error("Error refreshing profile:", refreshError);
        // Profile was saved, just couldn't refresh - reload the page
        window.location.reload();
      }

      toast.success(t?.Profile?.ProfileSaved ?? "Profile saved");
    } catch (error: any) {
      const backendError = error.response?.data?.error;
      setError(backendError || "Something went wrong. Please try again later.");
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-gradient-to-b from-background to-muted/20">
      <AlertDialog open={deleteAvatarDialogOpen} onOpenChange={setDeleteAvatarDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t?.Profile?.DeleteAvatarTitle ?? "Delete profile picture?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t?.Profile?.DeleteAvatarDescription ??
                "Are you sure you want to delete your profile picture?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t?.Profile?.Cancel ?? "Cancel"}</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button variant="destructive" type="button" onClick={confirmDeleteAvatar}>
                {t?.Profile?.DeleteAvatarConfirm ?? "Delete"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="w-full max-w-5xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {error && (
          <Alert variant="destructive">
            <AlertCircleIcon className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl md:text-6xl font-black tracking-tighter bg-gradient-to-r from-white via-primary/50 to-white bg-clip-text text-transparent pb-2">
            {t?.DropDown?.Profile || "PROFILE"}
          </h1>
        </div>

        {/* Main Card */}
        <div className="group relative">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-primary via-purple-500 to-primary rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-500"></div>
          <Card className="relative border-0 bg-card/95 backdrop-blur-sm">
            <CardContent className="p-8 space-y-8">
              {/* Action Buttons */}
              <div className="flex justify-end gap-3">
                {isEditMode ? (
                  <>
                    <Button variant="outline" onClick={handleCancel} size="lg">
                      {t?.Profile?.Cancel || "Cancel"}
                    </Button>
                    <Button variant="default" onClick={handleSave} size="lg">
                      {t?.Profile?.Save || "Save"}
                    </Button>
                  </>
                ) : (
                  <Button variant="default" onClick={handleEdit} size="lg">
                    {t?.Profile?.Edit || "Edit"}
                  </Button>
                )}
              </div>
              {/* Avatar Section */}
              <div className="flex flex-col items-center gap-6">
                <div className="relative">
                  <Avatar className="h-48 w-48 border-4 border-primary/20">
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
                        className="absolute right-2 bottom-3 h-12 w-12 rounded-full flex items-center justify-center bg-primary text-white cursor-pointer shadow-lg hover:bg-primary/90 transition-all"
                      >
                        <Camera className="h-5 w-5" />
                      </Label>
                      {preview && (
                        <button
                          onClick={handleDeleteAvatarClick}
                          className="absolute left-2 bottom-3 h-12 w-12 rounded-full flex items-center justify-center bg-destructive text-white cursor-pointer shadow-lg hover:bg-destructive/90 transition-all"
                          type="button"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      )}
                    </>
                  )}
                  <Input
                    ref={avatarInputRef}
                    type="file"
                    id="avatar"
                    name="avatar"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                    disabled={!isEditMode}
                  />
                </div>
                <div className="text-center">
                  <h2 className="text-2xl font-bold">{profile.username || "User"}</h2>
                  <p className="text-muted-foreground">{profile.email}</p>
                </div>
              </div>
              {/* Form Fields */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Email - Read Only */}
                <div className="grid gap-3">
                  <Label htmlFor="email" className="flex items-center gap-2 text-sm font-semibold">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {t?.["Login & Sign up"]?.Email || "Email"}
                  </Label>
                  <Input
                    type="email"
                    id="email"
                    name="email"
                    value={profile.email}
                    disabled
                    className="bg-muted/30 cursor-not-allowed"
                  />
                  <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                </div>
                
                {/* Username */}
                <div className="grid gap-3">
                  <Label htmlFor="username" className="flex items-center gap-2 text-sm font-semibold">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {t?.Profile?.Username || "Username"}
                  </Label>
                  <Input
                    type="text"
                    id="username"
                    name="username"
                    value={profile.username}
                    onChange={handleInputChange}
                    disabled={!isEditMode}
                    required={isEditMode}
                    minLength={1}
                    autoComplete="username"
                    className={cn(!isEditMode && "bg-muted/30")}
                  />
                </div>
                
                {/* Date of Birth */}
                <div className="grid gap-3">
                  <Label htmlFor="dob" className="flex items-center gap-2 text-sm font-semibold">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {t?.Profile?.DateofBirth || "Date of Birth"}
                  </Label>
                  <Input
                    type="date"
                    id="dob"
                    name="dob"
                    value={profile.dob}
                    onChange={handleInputChange}
                    disabled={!isEditMode}
                    className={cn(!isEditMode && "bg-muted/30")}
                  />
                </div>
                
                {/* Region */}
                <div className="grid gap-3">
                  <Label htmlFor="region" className="flex items-center gap-2 text-sm font-semibold">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {t?.Profile?.["Country/Region"] || "Country/Region"}
                  </Label>
                  <Input
                    type="text"
                    id="region"
                    name="region"
                    value={profile.region}
                    onChange={handleInputChange}
                    disabled={!isEditMode}
                    className={cn(!isEditMode && "bg-muted/30")}
                  />
                </div>
                
                {/* Bio - Full Width */}
                <div className="grid gap-3 md:col-span-2">
                  <Label htmlFor="bio" className="flex items-center gap-2 text-sm font-semibold">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Bio
                  </Label>
                  <Textarea
                    id="bio"
                    name="bio"
                    value={profile.bio}
                    onChange={handleInputChange}
                    disabled={!isEditMode}
                    placeholder="Tell us about yourself..."
                    className={cn("min-h-[120px] resize-none", !isEditMode && "bg-muted/30")}
                    maxLength={500}
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {profile.bio.length}/500 characters
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
