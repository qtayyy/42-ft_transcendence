'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AuthDialog } from "./auth";


export default function Header()
{
  const pathname = usePathname();

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
        {
          pathname === '/' ?
          <>
            <AuthDialog text="Sign In" />
            <AuthDialog text="Get Started" />
          </> :
          <Avatar>
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback>CN</AvatarFallback>
          </Avatar>
        }
          
       </div>
    </div>
  );  
}
