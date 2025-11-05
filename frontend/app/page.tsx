import { Button } from "@/components/ui/button"

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
            <Button className="w-40 h-12 text-lg">Start Playing</Button>
        </div>
    </div>
    
  );
}
