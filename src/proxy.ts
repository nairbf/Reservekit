import { NextRequest, NextResponse } from "next/server";

const PUBLIC_API_EXACT = new Set([
  "/api/auth/login",
  "/api/auth/admin-login",
  "/api/auth/demo-login",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/availability",
  "/api/menu/categories",
  "/api/reservations/request",
  "/api/loyalty/consent",
  "/api/payments/create-intent",
  "/api/payments/deposit-config",
  "/api/waitlist",
  "/api/waitlist/estimate",
  "/api/waitlist/status",
  "/api/cron/reminders",
  "/api/cron/spoton-sync",
  "/api/cron/daily-prep",
  "/api/checkout",
  "/api/health",
  "/api/stripe/callback",
  "/api/reservations/lookup",
  "/api/reservations/self-service",
  "/api/events",
  "/api/preorder",
  "/api/license/validate",
  "/api/demo/reset",
]);

function isPublicApi(pathname: string): boolean {
  if (PUBLIC_API_EXACT.has(pathname)) return true;
  if (pathname.startsWith("/api/uploads/serve/")) return true;
  if (pathname.startsWith("/api/events")) return true;
  if (pathname.startsWith("/api/preorder/") && pathname !== "/api/preorder/confirm") return true;
  if (pathname.startsWith("/api/webhooks/")) return true;
  return false;
}

function withSecurityHeaders(response: NextResponse) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return response;
}

export function proxy(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const pathname = req.nextUrl.pathname;
  const host = req.headers.get("host") || "";
  const isDemoHost = host.includes("demo.reservesit.com");

  // Auto-login for demo instance when unauthenticated.
  if (isDemoHost && !token) {
    if (pathname.startsWith("/dashboard") || pathname === "/login") {
      const destination = `${req.nextUrl.pathname}${req.nextUrl.search}`;
      const loginUrl = new URL(
        `/api/auth/demo-login?redirect=${encodeURIComponent(destination)}`,
        req.url,
      );
      return withSecurityHeaders(NextResponse.redirect(loginUrl));
    }
  }

  if (pathname.startsWith("/dashboard")) {
    if (!token) {
      const loginUrl = new URL("/login", req.url);
      return withSecurityHeaders(NextResponse.redirect(loginUrl));
    }
    return withSecurityHeaders(NextResponse.next());
  }

  if (pathname.startsWith("/api")) {
    if (!isPublicApi(pathname) && !token) {
      return withSecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    }
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*", "/login"],
};
