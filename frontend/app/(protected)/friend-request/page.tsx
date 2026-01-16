"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { FriendRequest } from "@/type/types";
import { useLanguage } from "@/context/languageContext";
import { useAuth } from "@/hooks/use-auth";

export default function FriendRequestsPage() {
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();
  const { user, loadingAuth } = useAuth();

  const fetchRequests = async () => {
    try {
      const res = await axios.get("/api/friends/pending");
      setRequests(res.data);
    } catch (error: any) {
      console.error("Failed to fetch friend requests:", error);
      // If 401, the ProtectedRoute will handle redirect
      if (error.response?.status !== 401) {
        // For other errors, set empty array to show "No pending requests"
        setRequests([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Wait for authentication to complete before fetching
    if (loadingAuth) return;
    if (!user) return; // ProtectedRoute will handle redirect
    
    async function load() {
      await fetchRequests();
    }
    load();
  }, [user, loadingAuth]);

  const accept = async (id: number) => {
    try {
      await axios.put(`/api/friends/request/${id}/accept`);
      await fetchRequests();
      // Refresh notifications in header
      window.dispatchEvent(new CustomEvent("refreshNotifications"));
    } catch (error: any) {
      console.error("Failed to accept friend request:", error);
    }
  };

  const decline = async (id: number) => {
    try {
      await axios.put(`/api/friends/request/${id}/decline`);
      await fetchRequests();
      // Refresh notifications in header
      window.dispatchEvent(new CustomEvent("refreshNotifications"));
    } catch (error: any) {
      console.error("Failed to decline friend request:", error);
    }
  };

  if (loading || loadingAuth) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">{t?.DropDown?.FriendRequests || "Friend Requests"}</h1>

      {requests.length === 0 && <p>{t?.FriendRequests?.["No pending requests"] || "No pending requests"}</p>}

      {requests.map((req) => (
        <div
          key={req.id}
          className="flex items-center justify-between border p-3 rounded-lg mb-2"
        >
          <span>{req.requester.username}</span>

          <div className="flex gap-2">
            <Button onClick={() => accept(req.id)}>{t?.FriendRequests?.Accept || "Accept"}</Button>
            <Button variant="destructive" onClick={() => decline(req.id)}>
              {t?.FriendRequests?.Decline || "Decline"}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
