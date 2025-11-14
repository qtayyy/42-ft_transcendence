"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AuthDialog } from "./auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useEffect, useState } from "react";
import Logo from "@/components/logo/logo.png";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [avatar, setAvatar] = useState("");
  const [username, setUsername] = useState("");
  const [mounted, setMounted] = useState(false);

  const handleLogOut = () => {
    try {
      axios.post("/api/auth/logout");
      router.push("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

   // I removed the dependency array but there should also be a better way
  // to handle when the profile pic changes.
  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    async function getAvatar() {
      try {
        // Paths are hardcoded - can find a better way to handle this.
        if (pathname !== "/" && pathname !== "/2fa/verify") {
          const { data } = await axios.get("/api/profile");
          // setAvatar(data.avatar);
          // setUsername(data.username);
          setAvatar(data.avatar || "");
          setUsername(data.username || "");
        }
        // catch (error) {
        //   console.error("Failed to fetch avatar", error);
      } catch (error: any) {
        
        // Only log if it's not a network/server error
        if (error.response?.status !== 502 && error.response?.status !== 503) {
          console.error("Failed to fetch avatar", error);
        }
        // Reset to defaults on error
        setAvatar("");
        setUsername("");
      }
    }
    /*
    getAvatar();
  });
    */
    if (mounted) {
      getAvatar();
    }
  }, [pathname, mounted]);

  return (
    <div className="sticky top-0 flex justify-between p-3 items-center dark:bg-background z-50">
      <div>
         {/* <Image
        src="/pong-icon.png"
        width={0}
        height={0}
        className="w-12 h-12"
        // className="hidden md:block"
        alt="Pong game logo">
        </Image> */}
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
      <div className="flex space-x-5">
        {pathname === "/2fa/verify" ? null : pathname === "/" ? (
          <>
            <AuthDialog text="Sign In" />
            <AuthDialog text="Get Started" />
          </>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Avatar>
                {avatar ? <AvatarImage src={avatar} /> : null}
                <AvatarFallback>
                  {/* {username ? username[0].toUpperCase() : "?"} */}
                  {mounted && username ? username[0].toUpperCase() : "?"}
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
              <DropdownMenuItem onClick={handleLogOut}>
                Log Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
