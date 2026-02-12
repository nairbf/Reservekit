import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { setAuthCookie, signSession, verifyPassword } from "@/lib/auth";
import { badRequest } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");

  if (!email || !password) return badRequest("Email and password are required");

  const user = await prisma.platformUser.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

  const valid = await verifyPassword(password, user.password);
  if (!valid) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

  const token = signSession({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
  setAuthCookie(response, token, req);
  return response;
}
