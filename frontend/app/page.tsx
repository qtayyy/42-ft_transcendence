"use client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function App()
{
  const router = useRouter();

  return (
    <div className="fixed inset-0 overflow-hidden">
      <video
        src="/assets/video/temp-pong.mp4"
        loop
        autoPlay
        muted
        playsInline
        className="h-full w-full object-cover"
      />
      <div
        className="fixed top-1/2 left-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 transform flex-col items-center gap-8 text-6xl font-bold text-gray-100"
      >
        FT_TRANSCENDENCE
        <Button variant="outline" className="text-2 p-6 w-30" onClick={() => router.push("/login")}>Sign In</Button>
      </div>
    </div>
  );
}
