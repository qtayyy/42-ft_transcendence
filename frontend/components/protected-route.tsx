"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

export const ProtectedRoute = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { isAuthenticated, loadingAuth } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loadingAuth && !isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthenticated, pathname, router, loadingAuth]);

  if (loadingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-accent">
        <p className="text-sm text-gray-300">Checking your session…</p>
      </div>
    );
  }

  return <>{children}</>;
};
