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
  const { t } = useLanguage(); // change language to header

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
        "fixed top-0 inset-x-0 bg-transparent" // Overlay on all pages
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
            {/* Notification bell - WIP */}
            <DropdownMenu>
              <DropdownMenuTrigger>{t.header.notification}</DropdownMenuTrigger>
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
                {t.header.profile}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/match")}>
                {t.header.matchHistory}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/friend-request")}>
                {t.header.friendRequests}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                {t.header.settings}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>
                {t.header.logout}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </>
        )}
      </div>
    </div>
  );
}
