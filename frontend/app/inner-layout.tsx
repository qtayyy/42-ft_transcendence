"use client";

import Header from "@/components/header";
import Footer from "@/components/footer";
import { useAuth } from "@/hooks/use-auth";

export default function InnerLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  return (
    <>
      {user && <Header />}
      <main className="min-h-screen w-screen">{children}</main>
        <Footer />
    </>
  );
}
