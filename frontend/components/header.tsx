"use client";
import { toast } from "sonner";

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
import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useSocket } from "@/hooks/use-socket";
import { useGame } from "@/hooks/use-game";
import { useLanguage } from "@/context/languageContext";
import { useMusic } from "@/context/music-context";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Menu, Volume2, VolumeX } from "lucide-react";

// Routes where the profile icon should be hidden (non-authenticated pages)
const NON_AUTHENTICATED_ROUTES = [
  "/",
  "/login",
  "/signup",
  "/reset-pwd",
  "/2fa/verify",
];

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, loadingAuth } = useAuth();
  const { sendSocketMessage, isReady } = useSocket();
  const { gameRoom, gameState, setShowNavGuard, setPendingPath } = useGame();
  const { t } = useLanguage(); // change language to header
  const { enabled: isMusicEnabled, toggleMusic } = useMusic();
  const [musicToggleHydrated, setMusicToggleHydrated] = useState(false);
  const displayedMusicEnabled = musicToggleHydrated ? isMusicEnabled : true;

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      setMusicToggleHydrated(true);
    }, 0);

    return () => window.clearTimeout(hydrationTimer);
  }, []);

  // Check if current route is a non-authenticated page
  const isNonAuthenticatedPage = useMemo(() => {
    return NON_AUTHENTICATED_ROUTES.includes(pathname);
  }, [pathname]);

  // Check if we're on a protected route (where sidebar is shown)
  const isProtectedRoute = useMemo(() => {
    return Boolean(user && !isNonAuthenticatedPage);
  }, [user, isNonAuthenticatedPage]);

  // Check if an active match is in progress (not over)
  const isRuntimeMatchRoute = useMemo(() => {
    const match = pathname.match(/^\/game\/([^/]+)$/);
    if (!match) return false;
    const routeId = match[1];
    return routeId !== "new" && routeId !== "remote" && routeId !== "local";
  }, [pathname]);
  const isTournamentLobbyRoute = useMemo(
    () =>
      /^\/game\/remote\/tournament\/RT-/.test(pathname) ||
      /^\/game\/local\/tournament\/[^/]+$/.test(pathname),
    [pathname]
  );
  const isGameActive = useMemo(() => {
    return (gameState && !gameState.gameOver) || isRuntimeMatchRoute || isTournamentLobbyRoute;
  }, [gameState, isRuntimeMatchRoute, isTournamentLobbyRoute]);

  // Only show profile icon if user exists AND we're not on a non-authenticated page
  const shouldShowProfileIcon = Boolean(user && !isNonAuthenticatedPage && !loadingAuth);

  const handleLogout = useCallback(async () => {
    if (!user) return;

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

  const navigateTo = useCallback((path: string) => {
    if (isGameActive) {
      setPendingPath(path);
      setShowNavGuard(true);
      return;
    }
    router.push(path);
  }, [isGameActive, router, setShowNavGuard, setPendingPath]);

  return (
    <div
      suppressHydrationWarning
      className={cn(
        "isolate z-50 flex w-full items-center justify-between p-3",
        "fixed top-0 inset-x-0 bg-transparent"
      )}
    >
      {/*
        Blur only the page content underneath the fixed header. The gradient
        mask keeps the header itself visually transparent and avoids a hard
        edge where the protected, non-clickable area ends.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-transparent backdrop-blur-md [mask-image:linear-gradient(to_bottom,black_75%,transparent)]"
      />
      <div>
        <button
          type="button"
          onClick={handleLogoClick}
          className="p-0 border-0 bg-transparent cursor-pointer hover:opacity-80 transition-opacity"
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
        <button
          type="button"
          onClick={toggleMusic}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
          aria-label={displayedMusicEnabled ? "Disable music" : "Enable music"}
          title={displayedMusicEnabled ? "Disable music" : "Enable music"}
        >
          {displayedMusicEnabled ? (
            <Volume2 className="w-6 h-6" />
          ) : (
            <VolumeX className="w-6 h-6" />
          )}
        </button>

        {/* Language Switcher  */}
        <LanguageSwitcher />
        
        {/* Hamburger Menu Button - only on protected routes */}
        {!loadingAuth && isProtectedRoute && (
          <button
            onClick={() => {
              const event = new CustomEvent('toggle-sidebar');
              window.dispatchEvent(event);
            }}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Toggle sidebar"
          >
            <Menu className="w-6 h-6" />
          </button>
        )}

        {/* Show dropdown only on non-protected routes, on protected routes the sidebar handles navigation */}
        {shouldShowProfileIcon && !isProtectedRoute && (
          <>
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
