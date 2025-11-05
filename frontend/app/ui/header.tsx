import Image from 'next/image';
import { Button } from "@/components/ui/button"

export default function Header()
{
  return (
    <div className="sticky top-0 flex justify-between p-3 items-center dark:bg-background z-50">
      <div>
        {/* <Image
        src="/pong-icon.png"
        width={0}
        height={0}
        className="w-12 h-12"
        // className="hidden md:block"
        alt="Pong game logo">
        </Image> */}
        <p className="text-gray-100">Logo placeholder</p>
      </div>
      <div className="flex space-x-5">
          <Button variant="outline">Sign In</Button>
          <Button variant="outline">Get Started</Button>
       </div>
    </div>
  );  
}
