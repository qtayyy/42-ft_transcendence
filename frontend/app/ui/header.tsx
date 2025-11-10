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

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogOut = () => {
    try {
      axios.post("/api/auth/logout");
      router.push("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

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
        <p className="text-gray-100">Logo placeholder</p>
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
                <AvatarImage src="https://github.com/shadcn.png" />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Match History</DropdownMenuItem>
              <DropdownMenuItem>Settings</DropdownMenuItem>
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
