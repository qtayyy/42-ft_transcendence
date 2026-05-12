"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FriendRequest } from "@/types/types";
import { useLanguage } from "@/context/languageContext";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { Users, UserPlus, MessageCircle, Check, X, Search, UserMinus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import SearchBar from "@/components/search-bar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Friend {
  id: number;
  username: string;
  avatar?: string;
}

export default function FriendRequestsPage() {
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [userFound, setUserFound] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [removeFriendTarget, setRemoveFriendTarget] = useState<Friend | null>(null);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const { t } = useLanguage();
  const { user, loadingAuth } = useAuth();
  const router = useRouter();

  const fetchRequests = async () => {
    try {
      const res = await axios.get("/api/friends/pending");
      setRequests(res.data);
    } catch (error: any) {
      console.error("Failed to fetch friend requests:", error);
      if (error.response?.status !== 401) {
        setRequests([]);
      }
    }
  };

  const fetchFriends = async () => {
    try {
      const res = await axios.get("/api/friends");
      setFriends(res.data);
    } catch (error: any) {
      console.error("Failed to fetch friends:", error);
      if (error.response?.status !== 401) {
        setFriends([]);
      }
    }
  };

  useEffect(() => {
    if (loadingAuth) return;
    if (!user) return;
    
    async function load() {
      await Promise.all([fetchRequests(), fetchFriends()]);
      setLoading(false);
    }
    load();
  }, [user, loadingAuth]);

  // Real-time: refresh pending requests when a new friend request arrives via websocket
  useEffect(() => {
    const handleFriendRequest = () => {
      fetchRequests();
    };
    window.addEventListener("friendRequest", handleFriendRequest as EventListener);
    return () => window.removeEventListener("friendRequest", handleFriendRequest as EventListener);
  }, []);

  const accept = async (id: number) => {
    try {
      await axios.put(`/api/friends/request/${id}/accept`);
      await Promise.all([fetchRequests(), fetchFriends()]);
    } catch (error: any) {
      console.error("Failed to accept friend request:", error);
    }
  };

  const decline = async (id: number) => {
    try {
      await axios.put(`/api/friends/request/${id}/decline`);
      await fetchRequests();
    } catch (error: any) {
      console.error("Failed to decline friend request:", error);
    }
  };

  const handleChatClick = (friendId: number) => {
    router.push(`/chat?userId=${friendId}`);
  };

  const handleRemoveFriend = async () => {
    if (!removeFriendTarget) return;
    try {
      await axios.delete(`/api/friends/${removeFriendTarget.id}`);
      setFriends((prev) => prev.filter((f) => f.id !== removeFriendTarget.id));
      setRemoveDialogOpen(false);
      setRemoveFriendTarget(null);
    } catch (error: any) {
      const backendError = error.response?.data?.error;
      toast.error(backendError || "Failed to remove friend. Please try again.");
    }
  };

  const handleSearchUser = async (query: string) => {
    try {
      setUserFound("");
      const res = await axios.get(`/api/friends/search?user=${query}`);
      setUserFound(res.data);
      setDialogOpen(true);
    } catch (error: any) {
      const backendError = error.response?.data?.error;
      toast.error(backendError || "Something went wrong. Please try again later.");
    }
  };

  const sendFriendRequest = async () => {
    try {
      const res = await axios.post("/api/friends/request", {
        username: userFound,
      });
      setDialogOpen(false);
      toast.success(res.data.message ?? "Friend request sent.");
      // Refresh pending requests to show the new request if accepted immediately
      await fetchRequests();
    } catch (error: any) {
      const backendError = error.response?.data?.error;
      toast.error(backendError || "Something went wrong. Please try again later.");
    }
  };

  if (loading || loadingAuth) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-gradient-to-b from-background to-muted/20">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-gradient-to-b from-background to-muted/20">
      <div className="w-full max-w-5xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl md:text-6xl font-black tracking-tighter bg-gradient-to-r from-white via-primary/50 to-white bg-clip-text text-transparent pb-2">
            {t?.DropDown?.FriendRequests || "Friends"}
          </h1>
        </div>

        {/* Search Bar */}
        <div className="group relative max-w-2xl mx-auto">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-500"></div>
          <Card className="relative border-0 bg-card/95 backdrop-blur-sm">
            <CardHeader className="text-center pb-3">
              <div className="mx-auto p-3 rounded-2xl bg-green-500/10 mb-3 group-hover:bg-green-500/20 transition-colors w-fit">
                <Search className="h-8 w-8 text-green-500" />
              </div>
              <CardTitle className="text-2xl font-bold">
                {t?.Dashboard?.Search || "Search Friends"}
              </CardTitle>
              <CardDescription>
                {t?.FriendRequests?.["Find and connect with new friends"] || "Find and connect with new friends"}
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-6">
              <SearchBar searchUser={handleSearchUser} />
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Pending Friend Requests */}
          <div className="group relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-500"></div>
            <Card className="relative h-full border-0 bg-card/95 backdrop-blur-sm">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto p-4 rounded-2xl bg-orange-500/10 mb-4 group-hover:bg-orange-500/20 transition-colors w-fit">
                  <UserPlus className="h-10 w-10 text-orange-500" />
                </div>
                <CardTitle className="text-3xl font-bold">
                  {t?.DropDown?.FriendRequests || "Friend Requests"}
                </CardTitle>
                <CardDescription className="text-base">
                  {requests.length} {requests.length !== 1 ? (t?.FriendRequests?.["pending requests"] || "pending requests") : (t?.FriendRequests?.["pending request"] || "pending request")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="bg-muted/30 backdrop-blur-sm border border-border/50 rounded-lg min-h-[300px] max-h-[500px] overflow-y-auto p-4 space-y-3">
                  {requests.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <UserPlus className="h-12 w-12 text-muted-foreground/50 mb-3" />
                      <p className="text-muted-foreground">
                        {t?.FriendRequests?.["No pending requests"] || "No pending requests"}
                      </p>
                    </div>
                  ) : (
                    requests.map((req) => (
                      <div
                        key={req.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50 hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border-2 border-primary/20">
                            <AvatarImage src={req.requester?.avatar} />
                            <AvatarFallback className="text-sm">
                              {req.requester.username[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{req.requester.username}</span>
                        </div>

                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="default"
                            onClick={() => accept(req.id)}
                            className="gap-1"
                          >
                            <Check className="h-4 w-4" />
                            {t?.FriendRequests?.Accept || "Accept"}
                          </Button>
                          <Button 
                            size="sm"
                            variant="destructive" 
                            onClick={() => decline(req.id)}
                            className="gap-1"
                          >
                            <X className="h-4 w-4" />
                            {t?.FriendRequests?.Decline || "Decline"}
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Friends List */}
          <div className="group relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-500"></div>
            <Card className="relative h-full border-0 bg-card/95 backdrop-blur-sm">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto p-4 rounded-2xl bg-blue-500/10 mb-4 group-hover:bg-blue-500/20 transition-colors w-fit">
                  <Users className="h-10 w-10 text-blue-500" />
                </div>
                <CardTitle className="text-3xl font-bold">
                  {t?.Dashboard?.Friends || "My Friends"}
                </CardTitle>
                <CardDescription className="text-base">
                  {friends.length} {friends.length !== 1 ? (t?.FriendRequests?.["friends"] || "friends") : (t?.FriendRequests?.["friend"] || "friend")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="bg-muted/30 backdrop-blur-sm border border-border/50 rounded-lg min-h-[300px] max-h-[500px] overflow-y-auto p-4 space-y-3">
                  {friends.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Users className="h-12 w-12 text-muted-foreground/50 mb-3" />
                      <p className="text-muted-foreground">
                        {t?.FriendRequests?.["No friends yet. Start by accepting friend requests!"] || "No friends yet. Start by accepting friend requests!"}
                      </p>
                    </div>
                  ) : (
                    friends.map((friend) => (
                      <div
                        key={friend.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50 hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border-2 border-primary/20">
                            <AvatarImage src={friend.avatar} />
                            <AvatarFallback className="text-sm">
                              {friend.username[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{friend.username}</span>
                        </div>

                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="default"
                            onClick={() => handleChatClick(friend.id)}
                            className="gap-2"
                          >
                            <MessageCircle className="h-4 w-4" />
                            {t?.FriendRequests?.["Chat"] || "Chat"}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setRemoveFriendTarget(friend);
                              setRemoveDialogOpen(true);
                            }}
                            className="gap-2"
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Remove Friend Confirmation Dialog */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent className="p-10">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              {t?.FriendRequests?.["Remove Friend"] || "Remove Friend"}
            </DialogTitle>
            <DialogDescription className="text-base pt-2">
              {t?.FriendRequests?.["Are you sure you want to remove"] || "Are you sure you want to remove"}{" "}
              <strong>{removeFriendTarget?.username}</strong>{" "}
              {t?.FriendRequests?.["as a friend? This action cannot be undone."] || "as a friend? This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end pt-4">
            <Button variant="outline" onClick={() => setRemoveDialogOpen(false)}>
              {t?.Setting?.Cancel || "Cancel"}
            </Button>
            <Button variant="destructive" onClick={handleRemoveFriend}>
              {t?.FriendRequests?.["Remove"] || "Remove"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Friend Request Dialog */}
      {userFound ? (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="p-10">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">
                {t?.Dashboard?.Friends || "Send Friend Request"}
              </DialogTitle>
              <DialogDescription className="text-base pt-2">
                Click &lsquo;{t?.chat?.Send || "Send"}&rsquo; to send a friend request to:
              </DialogDescription>
              <p className="text-4xl font-bold pt-4 text-primary">{userFound}</p>
            </DialogHeader>
            <div className="grid justify-end pt-4">
              <Button
                className="w-40"
                variant="default"
                onClick={sendFriendRequest}
                size="lg"
              >
                {t?.chat?.Send || "Send"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
