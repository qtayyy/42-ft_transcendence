"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { ProtectedRoute } from "@/components/protected-route";
import { Sidebar } from "@/components/sidebar";
import { cn } from "@/lib/utils";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const isRuntimeMatchRoute =
    /^\/game\/[^/]+$/.test(pathname) &&
    !["/game/new", "/game/local", "/game/remote"].includes(pathname);
  
  return (
    <ProtectedRoute>
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      <div
        className={cn(
          isRuntimeMatchRoute
            ? "h-dvh overflow-hidden"
            : "pt-28 pb-20 min-h-screen"
        )}
      >
        {children}
      </div>
    </ProtectedRoute>
  );
}
