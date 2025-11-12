import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const pathname = req.nextUrl.pathname;

  const isLoginPage = pathname === "/";

  if (!token && !isLoginPage) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher:  ["/dashboard/:path*" , "/2fa/:path*", "/profile/:path*"]
};
