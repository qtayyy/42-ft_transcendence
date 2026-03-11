"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  User, 
  Mail, 
  Calendar, 
  MapPin, 
  FileText, 
  Trophy, 
  XCircle, 
  ArrowLeft,
  Loader2
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/context/languageContext";

interface UserProfile {
  id: number;
  username: string;
  email: string;
  avatar: string | null;
  region: string | null;
  bio: string | null;
  dob: string | null;
  wins: number;
  losses: number;
  createdAt: string;
}

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const username = params.username as string;
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Redirect to own profile if viewing self
  useEffect(() => {
    if (user?.username === username) {
      router.push("/profile");
    }
  }, [user, username, router]);

  useEffect(() => {
    async function fetchUserProfile() {
      try {
        setLoading(true);
        setError("");
        
        const response = await fetch(`/api/profile/${username}`);
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to fetch profile");
        }

        const data = await response.json();
        setProfile(data);
      } catch (err: any) {
        console.error("Error fetching profile:", err);
        setError(err.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    }

    if (username && user?.username !== username) {
      fetchUserProfile();
    }
  }, [username, user]);

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="container mx-auto p-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Alert variant="destructive">
          <AlertDescription>
            {error || "User not found"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const winRate = profile.wins + profile.losses > 0
    ? ((profile.wins / (profile.wins + profile.losses)) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="container mx-auto p-6">
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Profile Header */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              <div className="relative group">
                <Avatar className="h-32 w-32">
                  <AvatarImage 
                    src={profile.avatar || undefined} 
                    alt={profile.username}
                  />
                  <AvatarFallback className="text-2xl">
                    {profile.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>

              <div className="flex-1 text-center md:text-left">
                <h1 className="text-3xl font-bold mb-2">{profile.username}</h1>
                
                <div className="space-y-2 mt-4">
                  <div className="flex items-center justify-center md:justify-start gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>{profile.email}</span>
                  </div>
                  
                  {profile.region && (
                    <div className="flex items-center justify-center md:justify-start gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>{profile.region}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-center md:justify-start gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      Joined {new Date(profile.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {profile.bio && (
              <div className="mt-6 pt-6 border-t">
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 mt-1 text-muted-foreground" />
                  <p className="text-muted-foreground">{profile.bio}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Game Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Game Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {profile.wins}
                </div>
                <div className="text-sm text-muted-foreground">
                  Wins
                </div>
              </div>
              
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {profile.losses}
                </div>
                <div className="text-sm text-muted-foreground">
                  Losses
                </div>
              </div>
              
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold">
                  {profile.wins + profile.losses}
                </div>
                <div className="text-sm text-muted-foreground">
                  Total Games
                </div>
              </div>
              
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-primary">
                  {winRate}%
                </div>
                <div className="text-sm text-muted-foreground">
                  Win Rate
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
