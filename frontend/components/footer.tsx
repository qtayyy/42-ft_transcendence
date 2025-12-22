"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
<<<<<<< HEAD
import { useMemo } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";

const NON_AUTHENTICATED_ROUTES = [
  "/",
  "/login",
  "/signup",
  "/reset-password",
  "/reset-pwd",
  "/2fa/verify",
];
=======
>>>>>>> 3b7dd28 (merge: merge main branch)

export default function Footer() {
  const pathname = usePathname();
  const isLanding = pathname === "/";

  return (
    <div
      className={cn(
        "z-40 w-full p-3 text-gray-100",
<<<<<<< HEAD
        "fixed inset-x-0 bottom-0 bg-background/60 backdrop-blur"
=======
        isLanding
          ? "fixed inset-x-0 bottom-0 bg-background/60 backdrop-blur"
          : "sticky bottom-0 bg-background"
>>>>>>> 3b7dd28 (merge: merge main branch)
      )}
    >
      {/* <div className="flex items-center justify-end"> */}
        {/* <LanguageSwitcher /> */}
      {/* </div> */}
    </div>
  );
}
