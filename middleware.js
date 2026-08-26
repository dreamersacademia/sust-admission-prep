import { NextResponse } from "next/server";
import { verifyAdminSessionToken, SESSION_COOKIE } from "@/lib/server/adminSession";

/**
 * This is what was missing: without this file, /admin/dashboard rendered
 * for anyone who typed the URL, regardless of whether they'd been through
 * /admin/login. Middleware runs on the server BEFORE the page component
 * even starts rendering, so there's no client-side flash of protected
 * content either — the redirect happens before any admin data or UI is
 * sent to the browser.
 */
export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // /admin/login itself must stay reachable, obviously — everything else
  // under /admin is gated.
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const session = token ? await verifyAdminSessionToken(token) : null;

    if (!session) {
      const loginUrl = new URL("/admin/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
