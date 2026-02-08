import { NextRequest, NextResponse } from "next/server";

const PUBLIC_API_EXACT = new Set([
  "/api/auth/login",
  "/api/availability",
  "/api/reservations/request",
  "/api/loyalty/consent",
  "/api/payments/create-intent",
  "/api/payments/deposit-config",
  "/api/waitlist",
  "/api/waitlist/estimate",
  "/api/waitlist/status",
  "/api/cron/reminders",
  "/api/checkout",
  "/api/health",
]);

function isPublicApi(pathname: string): boolean {
  if (PUBLIC_API_EXACT.has(pathname)) return true;
  if (pathname.startsWith("/api/webhooks/")) return true;
  return false;
}

export function middleware(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const pathname = req.nextUrl.pathname;

  if (pathname.startsWith("/dashboard")) {
    if (!token) {
      const loginUrl = new URL("/login", req.url);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    if (!isPublicApi(pathname) && !token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
};
