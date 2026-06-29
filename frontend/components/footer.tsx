"use client";

import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/languageContext";
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
  const { t } = useLanguage();
  const year = new Date().getFullYear();
  const copyright = t.Footer.Copyright.replace("{year}", String(year));

  return (
    <footer
      suppressHydrationWarning
      className={cn(
        "z-40 w-full px-4 py-2 text-gray-100",
        "fixed inset-x-0 bottom-0 bg-background/60 backdrop-blur"
      )}
    >
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <Link href="/privacy-policy" className="hover:text-foreground transition-colors underline-offset-4 hover:underline">
          Privacy Policy
        </Link>
        <span>·</span>
        <Link href="/terms-of-service" className="hover:text-foreground transition-colors underline-offset-4 hover:underline">
          Terms of Service
        </Link>
        <span>·</span>
        <span>{copyright}</span>
      </div>
    </footer>
  );
}
