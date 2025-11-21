"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import Logo from "@/components/logo/logo.png";

export default function Header() {
  const router = useRouter();

  return (
    <div
      className="z-50 flex w-full items-center justify-between p-3 sticky top-0 bg-background">
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
      <div className="flex space-x-5">
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Avatar className="w-15 h-15">
                {/* {avatar ? <AvatarImage src={avatar} /> : null} */}
                <AvatarFallback>
                  {/* {mounted && username ? username[0].toUpperCase() : "?"} */}
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
              <DropdownMenuItem>
                Log Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
      </div>
    </div>
  );
}
