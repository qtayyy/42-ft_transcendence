"use client";

import Link from "next/link";
import { useLanguage } from "@/context/languageContext";

export default function Footer() {
  const { t } = useLanguage();
  const year = new Date().getFullYear();
  const copyright = t.Footer.Copyright.replace("{year}", String(year));

  return (
    <footer
      suppressHydrationWarning
      className="w-full px-4 py-3 text-gray-400 text-xs border-t border-white/10 bg-background"
    >
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <span>{copyright}</span>
        <span className="text-gray-600" aria-hidden>
          |
        </span>
        <Link
          href="/terms-of-service"
          className="hover:text-gray-100 transition-colors"
        >
          {t.Footer["Terms of Service"]}
        </Link>
        <span className="text-gray-600" aria-hidden>
          |
        </span>
        <Link
          href="/privacy-policy"
          className="hover:text-gray-100 transition-colors"
        >
          {t.Footer["Privacy Policy"]}
        </Link>
      </div>
    </footer>
  );
}
