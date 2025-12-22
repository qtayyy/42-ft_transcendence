"use client";
import { toast } from "sonner";

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
<<<<<<< HEAD
import { useCallback, useMemo, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useSocket } from "@/hooks/use-socket";
import { useGame } from "@/hooks/use-game";
import { useLanguage } from "@/context/languageContext";
import { LanguageSwitcher } from "@/components/language-switcher";
=======
import { useCallback, useMemo } from "react";
>>>>>>> 3b7dd28 (merge: merge main branch)

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
<<<<<<< HEAD
  const { sendSocketMessage, isReady } = useSocket();
  const { gameRoom, gameState, setShowNavGuard, setPendingPath } = useGame();
  const { t } = useLanguage(); // change language to header
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);
=======
>>>>>>> 3b7dd28 (merge: merge main branch)

  // Check if current route is a non-authenticated page
  const isNonAuthenticatedPage = useMemo(() => {
    return NON_AUTHENTICATED_ROUTES.includes(pathname);
  }, [pathname]);

  // Check if an active match is in progress (not over)
  const isRemoteMatchRoute = useMemo(() => /^\/game\/(RS-|RT-)/.test(pathname), [pathname]);
  const isTournamentLobbyRoute = useMemo(
    () => /^\/game\/remote\/tournament\/RT-/.test(pathname),
    [pathname]
  );
  const isGameActive = useMemo(() => {
    return (gameState && !gameState.gameOver) || isRemoteMatchRoute || isTournamentLobbyRoute;
  }, [gameState, isRemoteMatchRoute, isTournamentLobbyRoute]);

  // Only show profile icon if user exists AND we're not on a non-authenticated page
  // Use hasMounted to prevent hydration mismatch
  const shouldShowProfileIcon = hasMounted && user && !isNonAuthenticatedPage;

  const handleLogout = useCallback(async () => {
    logout();
    router.push("/");
<<<<<<< HEAD
  }, [router, logout, user, isReady, sendSocketMessage, gameRoom]);

  function handleLogoClick() {
    if (isGameActive) {
      setPendingPath(user ? "/dashboard" : "/");
      setShowNavGuard(true);
      return;
    }
    if (user) {
      router.push("/dashboard");
    }
    else {
      router.push("/");
    }
  }
=======
  }, [router, logout]);
>>>>>>> 3b7dd28 (merge: merge main branch)

  const navigateTo = useCallback((path: string) => {
    if (isGameActive) {
      setPendingPath(path);
      setShowNavGuard(true);
      return;
    }
    router.push(path);
  }, [isGameActive, router, setShowNavGuard, setPendingPath]);

  return (
<<<<<<< HEAD
    <div className={cn(
      "z-50 flex w-full items-center justify-between p-3",
      "fixed top-0 inset-x-0 bg-transparent" // Overlay on all pages
    )}>
      <div>
        <button
          type="button"
          onClick={handleLogoClick}
          className="p-0 border-0 bg-transparent cursor-pointer hover:opacity-80 transition-opacity"
=======
    <div className="z-50 flex w-full items-center justify-between p-3 sticky top-0 bg-background">
      <div>
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="p-0 border-0 bg-transparent cursor-pointer"
>>>>>>> 3b7dd28 (merge: merge main branch)
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
              <DropdownMenuTrigger>{t?.DropDown?.Notification || "Notification"}</DropdownMenuTrigger>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
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
                <DropdownMenuItem onClick={() => navigateTo("/profile")}>
                  {t?.DropDown?.Profile || "Profile"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigateTo("/match")}>
                  {t?.DropDown?.MatchHistory || "Match History"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigateTo("/friend-request")}>
                  {t?.DropDown?.FriendRequests || "Friend Requests"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigateTo("/settings")}>
                  {t?.DropDown?.Settings || "Settings"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={isGameActive ? () => toast.warning("Finish your match before logging out.") : handleLogout}>
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
