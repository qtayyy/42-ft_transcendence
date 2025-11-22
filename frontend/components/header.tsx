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
import Logo from "@/components/logo/logo.png";
import { useCallback, useMemo } from "react";

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

  // Check if current route is a non-authenticated page
  const isNonAuthenticatedPage = useMemo(() => {
    return NON_AUTHENTICATED_ROUTES.includes(pathname);
  }, [pathname]);

  // Only show profile icon if user exists AND we're not on a non-authenticated page
  const shouldShowProfileIcon = user && !isNonAuthenticatedPage;

  const handleLogout = useCallback(async () => {
    logout();
    router.push("/");
  }, [router, logout]);

  return (
    <div className="z-50 flex w-full items-center justify-between p-3 sticky top-0 bg-background">
      <div>
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="p-0 border-0 bg-transparent cursor-pointer"
          aria-label="Go to dashboard"
          suppressHydrationWarning
        >
          <Image
            src={Logo}
            alt="FT Transcendence logo"
            width={90}
            height={90}
            priority
          />
        </button>
      </div>
      {shouldShowProfileIcon && (
        <div className="flex space-x-5">
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
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>Log Out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
