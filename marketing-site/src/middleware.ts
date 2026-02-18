import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/customer-auth";

const PUBLIC_API_EXACT = new Set([
  "/api/auth/login",
  "/api/demo-request",
  "/api/checkout",
  "/api/checkout/upgrade",
  "/api/webhooks/stripe",
]);

function isPublicApi(pathname: string): boolean {
  if (PUBLIC_API_EXACT.has(pathname)) return true;
  if (pathname.startsWith("/api/webhooks/")) return true;
  return false;
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const token = request.cookies.get(AUTH_COOKIE)?.value;

  if (pathname.startsWith("/portal") && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname.startsWith("/api") && !isPublicApi(pathname) && !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/portal/:path*", "/api/:path*"],
};
