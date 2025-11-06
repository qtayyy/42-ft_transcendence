import { AuthDialog } from "./ui/auth";

export default function App()
{
  return (
    <div className="w-screen h-screen">
      <video src="/assets/video/temp-pong.mp4"
        loop
        autoPlay
        muted
        className="w-screen h-screen"
        />
        <div className="flex flex-col gap-8
          fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2
          text-gray-100 text-6xl font-bold items-center">
            FT_TRANSCENDENCE
            <AuthDialog text="Sign In" />
        </div>
    </div>
    
  );
}
