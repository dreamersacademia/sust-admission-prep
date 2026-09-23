import { NextResponse } from "next/server";
import { verifyAdminSessionToken, SESSION_COOKIE as ADMIN_COOKIE } from "@/lib/server/adminSession";
import { verifyModeratorSessionToken, SESSION_COOKIE as MODERATOR_COOKIE } from "@/lib/server/moderatorSession";

/**
 * Two independent gates, one middleware file. /admin/* and /moderator/*
 * check completely different cookies — a moderator session passing this
 * check for /moderator/* says nothing about /admin/*, and vice versa.
 */
export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const token = request.cookies.get(ADMIN_COOKIE)?.value;
    const session = token ? await verifyAdminSessionToken(token) : null;
    if (!session) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  if (pathname.startsWith("/moderator") && pathname !== "/moderator/login") {
    const token = request.cookies.get(MODERATOR_COOKIE)?.value;
    const session = token ? await verifyModeratorSessionToken(token) : null;
    if (!session) {
      return NextResponse.redirect(new URL("/moderator/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/moderator/:path*"],
};