"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
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

export default function Footer() {
  const pathname = usePathname();
  
  const isNonAuthenticatedPage = useMemo(() => {
    return NON_AUTHENTICATED_ROUTES.includes(pathname);
  }, [pathname]);

  return (
    <div
      className={cn(
        "z-40 w-full p-3 text-gray-100",
        "fixed inset-x-0 bottom-0 bg-background/60 backdrop-blur"
      )}
    >
      {/* <div className="flex items-center justify-end"> */}
        {/* <LanguageSwitcher /> */}
      {/* </div> */}
    </div>
  );
}
