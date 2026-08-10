import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth";

export const config = {
  matcher: ["/orders/:path*", "/login", "/signup"],
  runtime: "nodejs",
};

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("session")?.value;
  const user = token ? await verifySessionToken(token) : null;

  const { pathname } = req.nextUrl;
  const isAuthPage = pathname === "/login" || pathname === "/signup";

  if (!user && !isAuthPage) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL("/orders", req.url));
  }

  return NextResponse.next();
}
