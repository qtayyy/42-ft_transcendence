"use client";
import { useState } from "react";
import { ProtectedRoute } from "@/components/protected-route";
import { Sidebar } from "@/components/sidebar";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  return (
    <ProtectedRoute>
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      <div className="pt-28 pb-20 min-h-screen">
        {children}
      </div>
    </ProtectedRoute>
  );
}
