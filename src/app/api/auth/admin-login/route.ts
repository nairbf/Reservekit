import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

interface AdminLoginPayload {
  type: "admin_login";
  restaurantId: string;
  restaurantSlug: string;
  adminEmail: string;
  adminName: string;
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/login", request.url));

  const adminSecret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
  if (!adminSecret) return NextResponse.redirect(new URL("/login?error=config", request.url));

  const appSecret = process.env.JWT_SECRET || "dev-secret-change-me";

  try {
    const payload = jwt.verify(token, adminSecret) as AdminLoginPayload;
    if (payload.type !== "admin_login") throw new Error("Invalid token type");

    let user = await prisma.user.findUnique({ where: { email: payload.adminEmail } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: payload.adminEmail,
          name: `Admin: ${payload.adminName}`,
          passwordHash: "",
          role: "superadmin",
          isActive: true,
        },
      });
    } else if (!user.isActive) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { isActive: true },
      });
    }

    const sessionToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      appSecret,
      { expiresIn: "2h" },
    );

    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    response.cookies.set("token", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 2,
    });

    return response;
  } catch {
    return NextResponse.redirect(new URL("/login?error=invalid_admin_token", request.url));
  }
}
