"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useSocket } from "@/hooks/use-socket";
import { useGame } from "@/hooks/use-game";
import { useLanguage } from "@/context/languageContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  User,
  History,
  UserPlus,
  Settings,
  LogOut,
  MessageSquare,
} from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { sendSocketMessage, isReady } = useSocket();
  const { gameRoom, gameState, setShowNavGuard, setPendingPath } = useGame();
  const { t } = useLanguage();
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingFriendCount, setPendingFriendCount] = useState(0);

  // Listen for toggle event from header
  useEffect(() => {
    const handleToggle = () => {
      setIsOpen(!isOpen);
    };
    
    window.addEventListener('toggle-sidebar', handleToggle);
    return () => window.removeEventListener('toggle-sidebar', handleToggle);
  }, [isOpen, setIsOpen]);

  // Fetch unread chat count
  useEffect(() => {
    let isMounted = true;

    const fetchUnreadCount = async () => {
      try {
        const response = await fetch("/api/chat/unread");
        if (!response.ok) return;
        const data = await response.json();
        if (isMounted) {
          setUnreadCount(Number(data?.unreadCount) || 0);
        }
      } catch (error) {
        console.error("Failed to load unread chat count", error);
      }
    };

    const handleRealtimeUnreadRefresh = () => {
      fetchUnreadCount();
    };

    fetchUnreadCount();
    const intervalId = setInterval(fetchUnreadCount, 10000);
    window.addEventListener("chatMessage", handleRealtimeUnreadRefresh as EventListener);
    window.addEventListener("messageRead", handleRealtimeUnreadRefresh as EventListener);
    window.addEventListener("gameInvite", handleRealtimeUnreadRefresh as EventListener);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      window.removeEventListener("chatMessage", handleRealtimeUnreadRefresh as EventListener);
      window.removeEventListener("messageRead", handleRealtimeUnreadRefresh as EventListener);
      window.removeEventListener("gameInvite", handleRealtimeUnreadRefresh as EventListener);
    };
  }, []);

  // Fetch pending friend request count and update in real-time
  useEffect(() => {
    let isMounted = true;

    const fetchPendingCount = async () => {
      try {
        const res = await fetch("/api/friends/pending");
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted) setPendingFriendCount(Array.isArray(data) ? data.length : 0);
      } catch {}
    };

    fetchPendingCount();

    const handleFriendRequest = () => {
      fetchPendingCount();
    };
    window.addEventListener("friendRequest", handleFriendRequest as EventListener);

    return () => {
      isMounted = false;
      window.removeEventListener("friendRequest", handleFriendRequest as EventListener);
    };
  }, []);

  // Clear badge when user navigates to friend-request page
  useEffect(() => {
    if (pathname === "/friend-request") {
      setPendingFriendCount(0);
    }
  }, [pathname]);

  // Check if an active match is in progress (not over)
  const isRuntimeMatchRoute = pathname.match(/^\/game\/([^/]+)$/) && 
    !pathname.includes("/game/new") && 
    !pathname.includes("/game/remote") && 
    !pathname.includes("/game/local");
    
  const isTournamentLobbyRoute =
    /^\/game\/remote\/tournament\/RT-/.test(pathname) ||
    /^\/game\/local\/tournament\/[^/]+$/.test(pathname);
    
  const isGameActive = (gameState && !gameState.gameOver) || isRuntimeMatchRoute || isTournamentLobbyRoute;

  const handleLogout = async () => {
    if (!user) return;

    if (isGameActive) {
      toast.warning("Finish your match before logging out.");
      return;
    }

    if (isReady && gameRoom?.roomId) {
      sendSocketMessage({
        event: "LEAVE_ROOM",
        payload: {
          roomId: gameRoom.roomId,
          userId: user.id,
        },
      });
    }

    await logout();
    router.replace("/");
  };

  const navigateTo = (path: string) => {
    if (isGameActive) {
      setPendingPath(path);
      setShowNavGuard(true);
      return;
    }
    router.push(path);
  };

  const navItems = [
    {
      label: t?.DropDown?.Profile || "Profile",
      path: "/profile",
      icon: User,
    },
    {
      label: t?.DropDown?.MatchHistory || "Match History",
      path: "/match",
      icon: History,
    },
    {
      label: (t?.DropDown as any)?.Chat || "Chat",
      path: "/chat",
      icon: MessageSquare,
    },
    {
      label: t?.DropDown?.FriendRequests || "Friend Requests",
      path: "/friend-request",
      icon: UserPlus,
    },
    {
      label: t?.DropDown?.Settings || "Settings",
      path: "/settings",
      icon: Settings,
    },
  ];

  if (!user) return null;

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed right-0 top-0 h-screen w-64 bg-card border-l border-border pt-24 pb-6 flex flex-col z-40 transition-transform duration-300",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* User Profile Section */}
        <div className="px-6 mb-6">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <Avatar className="w-12 h-12">
            {user?.avatar ? <AvatarImage src={user.avatar} /> : null}
            <AvatarFallback className="text-lg">
              {user?.username ? user.username[0].toUpperCase() : "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{user?.username || "User"}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-3 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.path || pathname.startsWith(item.path + "/");
            const Icon = item.icon;
            
            return (
              <li key={item.path}>
                <button
                  onClick={() => navigateTo(item.path)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span>{item.label}</span>
                  {item.path === "/chat" && unreadCount > 0 && (
                    <Badge variant="destructive" className="ml-auto">
                      {unreadCount}
                    </Badge>
                  )}
                  {item.path === "/friend-request" && pendingFriendCount > 0 && (
                    <Badge variant="destructive" className="ml-auto">
                      {pendingFriendCount}
                    </Badge>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Logout Button */}
      <div className="px-3 pt-4 border-t border-border">
        <Button
          onClick={handleLogout}
          variant="ghost"
          className={cn(
            "w-full justify-start gap-3 text-muted-foreground hover:text-foreground",
            isGameActive && "opacity-50 cursor-not-allowed"
          )}
          disabled={isGameActive}
        >
          <LogOut className="w-5 h-5" />
          <span>{t?.DropDown?.Logout || "Logout"}</span>
        </Button>
      </div>
      </aside>
    </>
  );
}
