"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export default function Footer() {
  const pathname = usePathname();
  const isLanding = pathname === "/";

  return (
    <div
      className={cn(
        "z-40 w-full p-3 text-gray-100",
        isLanding
          ? "fixed inset-x-0 bottom-0 bg-background/60 backdrop-blur"
          : "sticky bottom-0 bg-background"
      )}
    >
      <p className="text-end">Switch Language (placeholder)</p>
    </div>
  );
}
