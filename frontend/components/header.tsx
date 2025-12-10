"use client";

import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useSocket } from "@/hooks/use-socket";
import { useGame } from "@/hooks/use-game";

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
        isNonAuthenticatedPage
          ? "fixed top-0 inset-x-0 bg-transparent" // Overlay on landing
          : "sticky top-0 bg-background" // Sticky on other pages
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
      {shouldShowProfileIcon && (
        <div className="flex space-x-5">
          {/* Notification bell - WIP */}
          <DropdownMenu>
            <DropdownMenuTrigger>Notification</DropdownMenuTrigger>
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
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/match")}>
                Match History
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/friend-request")}>
                Friend Requests
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>
                Log Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
