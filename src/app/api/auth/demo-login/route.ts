import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createToken } from "@/lib/auth";

export const runtime = "nodejs";

function safeRedirectPath(value: string | null): string {
  const fallback = "/dashboard";
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  return value;
}

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  if (!appUrl.includes("demo.reservesit.com")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const demoUser = await prisma.user.findFirst({
    where: {
      email: "demo@reservesit.com",
      isActive: true,
    },
  });

  if (!demoUser) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const token = createToken({
    id: demoUser.id,
    email: demoUser.email,
    role: demoUser.role,
  });

  const redirectParam = request.nextUrl.searchParams.get("redirect");
  const redirectTo = safeRedirectPath(redirectParam);
  const response = NextResponse.redirect(new URL(redirectTo, request.url));

  response.cookies.set("token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  return response;
}
