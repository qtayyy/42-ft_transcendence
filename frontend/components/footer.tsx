"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import Link from "next/link";

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
    <footer
      suppressHydrationWarning
      className="w-full px-4 py-3 text-gray-400 text-xs border-t border-white/10 bg-background"
    >
      <div className="flex items-center justify-center gap-4">
        <span>© {new Date().getFullYear()} Transcendence Into Unknown. All rights reserved.</span>
        <span className="text-gray-600">|</span>
        <Link
          href="/terms-of-service"
          className="hover:text-gray-100 transition-colors"
        >
          Terms of Service
        </Link>
        <span className="text-gray-600">|</span>
        <Link
          href="/privacy-policy"
          className="hover:text-gray-100 transition-colors"
        >
          Privacy Policy
        </Link>
      </div>
    </footer>
  );
}
