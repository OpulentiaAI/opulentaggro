import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { hasServerAuth } from "@/lib/auth/session";

const PUBLIC_PATHS = ["/login", "/api/", "/_next/", "/favicon.ico"];

function requiresAuth(pathname: string): boolean {
  return pathname.startsWith("/app") || pathname.startsWith("/erpnext");
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (pathname === "/") {
    return NextResponse.next();
  }

  if (!requiresAuth(pathname)) {
    return NextResponse.next();
  }

  const requireLogin = process.env.ERPNEXT_REQUIRE_LOGIN === "true";
  if (!requireLogin) {
    return NextResponse.next();
  }

  const sid = request.cookies.get("erpnext_sid")?.value;
  if (sid || hasServerAuth()) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/app/:path*", "/erpnext/:path*", "/login"],
};
