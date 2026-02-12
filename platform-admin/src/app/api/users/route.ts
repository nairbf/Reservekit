import { NextRequest, NextResponse } from "next/server";
import { PlatformRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword, requireSessionFromRequest } from "@/lib/auth";
import { forbidden, unauthorized, badRequest } from "@/lib/api";
import { isSuperAdmin } from "@/lib/rbac";

function parseRole(value: unknown): PlatformRole | null {
  const role = String(value || "").trim();
  if (role === "SUPER_ADMIN" || role === "ADMIN" || role === "SUPPORT") return role;
  return null;
}

export async function GET(req: NextRequest) {
  const session = (() => {
    try {
      return requireSessionFromRequest(req);
    } catch {
      return null;
    }
  })();
  if (!session) return unauthorized();
  if (!isSuperAdmin(session.role)) return forbidden();

  const users = await prisma.platformUser.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = (() => {
    try {
      return requireSessionFromRequest(req);
    } catch {
      return null;
    }
  })();
  if (!session) return unauthorized();
  if (!isSuperAdmin(session.role)) return forbidden();

  const body = await req.json();
  const email = String(body?.email || "").trim().toLowerCase();
  const name = String(body?.name || "").trim();
  const password = String(body?.password || "");
  const role = parseRole(body?.role || "ADMIN");

  if (!email || !name || !password || !role) {
    return badRequest("email, name, password, and role are required");
  }

  if (password.length < 8) {
    return badRequest("Password must be at least 8 characters");
  }

  const existing = await prisma.platformUser.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const user = await prisma.platformUser.create({
    data: {
      email,
      name,
      role,
      password: await hashPassword(password),
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(user, { status: 201 });
}
