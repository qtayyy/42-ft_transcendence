"use client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/languageContext";

export default function App() {
  const router = useRouter();
  const { t } = useLanguage();

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
        className="fixed top-1/2 left-1/2 z-10 flex w-[min(100%-2rem,42rem)] -translate-x-1/2 -translate-y-1/2 transform flex-col items-center gap-8 text-center text-[clamp(2rem,12vw,3.75rem)] font-bold leading-tight text-gray-100 break-words"
      >
        FT_TRANSCENDENCE
        <Button variant="outline" className="text-2 p-6 w-30" onClick={() => router.push("/login")}>
          {t?.["Login & Sign up"]?.Login || "Login"}
        </Button>
      </div>
    </div>
  );
}
