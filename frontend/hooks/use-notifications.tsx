"use client";

import { useState, useEffect, useCallback } from "react";
import { useSocketContext } from "@/context/socket-context";
import { useAuth } from "@/hooks/use-auth";
import axios from "axios";

export interface Notification {
  id: string;
  type: "friend_request";
  message: string;
  username: string;
  timestamp: Date;
  read: boolean;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { sendSocketMessage, isReady } = useSocketContext();
  const { user, loadingAuth } = useAuth();

  // Load existing friend requests on mount
  useEffect(() => {
    // Wait for authentication to complete before fetching
    if (loadingAuth) return;
    if (!user) {
      setLoaded(true);
      return; // Not authenticated, no notifications to load
    }

    async function loadFriendRequests() {
      try {
        const res = await axios.get("/api/friends/pending");
        const requests = res.data || [];
        const existingNotifications: Notification[] = requests.map((req: any) => ({
          id: `friend_request_${req.requester.id}_${req.id}`,
          type: "friend_request" as const,
          message: `${req.requester.username} has sent you a friend request, check it out`,
          username: req.requester.username,
          timestamp: new Date(req.createdAt),
          read: false,
        }));
        setNotifications(existingNotifications);
        setLoaded(true);
      } catch (error: any) {
        console.error("Failed to load friend requests:", error);
        // Only set loaded to true if it's not a 401 (auth error)
        // For 401, we'll wait and retry when auth completes
        if (error.response?.status !== 401) {
          setLoaded(true);
        }
      }
    }
    loadFriendRequests();

    // Listen for refresh events (when friend requests are accepted/declined)
    const handleRefresh = () => {
      loadFriendRequests();
    };
    window.addEventListener("refreshNotifications", handleRefresh);

    return () => {
      window.removeEventListener("refreshNotifications", handleRefresh);
    };
  }, [user, loadingAuth]);

  // Listen for friend request events
  useEffect(() => {
    if (!isReady) return;

    const handleFriendRequest = (event: CustomEvent) => {
      const payload = event.detail;
      if (payload.requesterUsername) {
        const newNotification: Notification = {
          id: `friend_request_${payload.requesterId}_${Date.now()}`,
          type: "friend_request",
          message: `${payload.requesterUsername} has sent you a friend request, check it out`,
          username: payload.requesterUsername,
          timestamp: new Date(),
          read: false,
        };
        setNotifications((prev) => {
          // Check if notification already exists
          const exists = prev.some(
            (n) => n.type === "friend_request" && n.username === payload.requesterUsername && !n.read
          );
          if (exists) return prev;
          return [newNotification, ...prev];
        });
      }
    };

    window.addEventListener("friendRequest" as any, handleFriendRequest);

    return () => {
      window.removeEventListener("friendRequest" as any, handleFriendRequest);
    };
  }, [isReady]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((notif) =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) =>
      prev.map((notif) => ({ ...notif, read: true }))
    );
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((notif) => notif.id !== id));
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
  };
}

