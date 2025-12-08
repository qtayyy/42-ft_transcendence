"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

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
        isNonAuthenticatedPage
          ? "fixed inset-x-0 bottom-0 bg-background/60 backdrop-blur"
          : "sticky bottom-0 bg-background"
      )}
    >
      <p className="text-end">Switch Language (placeholder)</p>
    </div>
  );
}
