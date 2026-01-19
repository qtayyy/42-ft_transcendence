"use client";

import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useSocket } from "@/hooks/use-socket";
import { useGame } from "@/hooks/use-game";
import { useLanguage } from "@/context/languageContext";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useNotifications } from "@/hooks/use-notifications";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

// Routes where the profile icon should be hidden (non-authenticated pages)
const NON_AUTHENTICATED_ROUTES = [
  "/",
  "/login",
  "/signup",
  "/reset-password",
  "/reset-pwd",
  "/2fa/verify",
];

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { sendSocketMessage, isReady } = useSocket();
  const { gameRoom } = useGame();
  const { t } = useLanguage(); 
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  // Check if current route is a non-authenticated page
  const isNonAuthenticatedPage = useMemo(() => {
    return NON_AUTHENTICATED_ROUTES.includes(pathname);
  }, [pathname]);

  // Only show profile icon if user exists AND we're not on a non-authenticated page
  const shouldShowProfileIcon = user && !isNonAuthenticatedPage;

  const handleLogout = useCallback(async () => {
    if (!user || !isReady) return;
    sendSocketMessage({
      event: "LEAVE_ROOM",
      payload: {
        roomId: gameRoom?.roomId,
        userId: user.id,
      },
    });
    logout();
    router.push("/");
  }, [router, logout, user, isReady, sendSocketMessage, gameRoom]);

  function handleLogoClick() {
    if (user) {
      router.push("/dashboard");
    }
    else {
      router.push("/");
    }
  }

  return (
    <div className={cn(
      "z-50 flex w-full items-center justify-between p-3",
      "fixed top-0 inset-x-0 bg-transparent" 
    )}>
      <div>
        <button
          type="button"
          onClick={handleLogoClick}
          className="p-0 border-0 bg-transparent cursor-pointer"
          aria-label="Go to dashboard"
          suppressHydrationWarning
        >
          <Image
            src="/logo.png"
            alt="FT Transcendence logo"
            width={90}
            height={90}
            priority
          />
        </button>
      </div>
      <div className="flex space-x-5 items-center">
        {/* Language Switcher  */}
        <LanguageSwitcher />

        {shouldShowProfileIcon && (
          <>
            {/* Notification bell */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative"
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="flex items-center justify-between p-2 border-b">
                  <h3 className="font-semibold">
                    {t?.DropDown?.Notification || "Notifications"}
                  </h3>
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={markAllAsRead}
                    >
                      Mark all as read
                    </Button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No notifications
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.map((notification) => (
                      <DropdownMenuItem
                        key={notification.id}
                        className={cn(
                          "flex flex-col items-start p-3 cursor-pointer",
                          !notification.read && "bg-muted/50"
                        )}
                        onClick={() => {
                          markAsRead(notification.id);
                          router.push("/friend-request");
                        }}
                      >
                        <div className="flex items-start justify-between w-full">
                          <p className="text-sm font-medium">
                            {notification.message}
                          </p>
                          {!notification.read && (
                            <span className="h-2 w-2 rounded-full bg-primary ml-2 flex-shrink-0 mt-1" />
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground mt-1">
                          {notification.timestamp.toLocaleTimeString()}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger>
                {/* Add key to force re-render when avatar changes */}
                <Avatar
                  className="w-15 h-15"
                  key={`avatar-${user?.avatar || "none"}-${user?.username || ""}`}
                >
                  {user?.avatar ? <AvatarImage src={user.avatar} /> : null}
                  <AvatarFallback className="text-2xl">
                    {user?.username ? user.username[0].toUpperCase() : "?"}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => router.push("/profile")}>
                  {t?.DropDown?.Profile || "Profile"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/match")}>
                  {t?.DropDown?.MatchHistory || "Match History"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/friend-request")}>
                  {t?.DropDown?.FriendRequests || "Friend Requests"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/settings")}>
                  {t?.DropDown?.Settings || "Settings"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                  {t?.DropDown?.Logout || "Logout"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </div>
  );
}
