import { NextRequest, NextResponse } from "next/server";
import { PlatformRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  hashPassword,
  requireSessionFromRequest,
  verifyPassword,
} from "@/lib/auth";
import { badRequest, forbidden, unauthorized } from "@/lib/api";
import { isSuperAdmin } from "@/lib/rbac";

function parseRole(value: unknown): PlatformRole | null {
  const role = String(value || "").trim();
  if (role === "SUPER_ADMIN" || role === "ADMIN" || role === "SUPPORT") return role;
  return null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = (() => {
    try {
      return requireSessionFromRequest(req);
    } catch {
      return null;
    }
  })();
  if (!session) return unauthorized();

  const { id } = await params;
  const body = await req.json();
  const target = await prisma.platformUser.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const isSelf = session.id === id;
  const superAdmin = isSuperAdmin(session.role);
  const wantsPasswordChange =
    body?.currentPassword !== undefined || body?.newPassword !== undefined;

  if (!isSelf && !superAdmin) return forbidden();

  if (isSelf && wantsPasswordChange) {
    const currentPassword = String(body?.currentPassword || "");
    const newPassword = String(body?.newPassword || "");

    if (!currentPassword || !newPassword) {
      return badRequest("currentPassword and newPassword are required");
    }

    const valid = await verifyPassword(currentPassword, target.password);
    if (!valid) return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    if (newPassword.length < 8) return badRequest("New password must be at least 8 characters");

    await prisma.platformUser.update({
      where: { id },
      data: { password: await hashPassword(newPassword) },
    });

    return NextResponse.json({ ok: true });
  }

  const role = body?.role !== undefined ? parseRole(body.role) : null;
  const email = body?.email !== undefined ? String(body.email || "").trim().toLowerCase() : undefined;
  const name = body?.name !== undefined ? String(body.name || "").trim() : undefined;
  const password = body?.password !== undefined ? String(body.password || "") : undefined;

  if (body?.role !== undefined && !role) return badRequest("Invalid role");
  if (password !== undefined && password.length > 0 && password.length < 8) {
    return badRequest("Password must be at least 8 characters");
  }

  if (role && target.role === "SUPER_ADMIN" && role !== "SUPER_ADMIN") {
    const superAdmins = await prisma.platformUser.count({ where: { role: "SUPER_ADMIN" } });
    if (superAdmins <= 1) {
      return badRequest("At least one SUPER_ADMIN must remain");
    }
  }

  const updated = await prisma.platformUser.update({
    where: { id },
    data: {
      ...(email !== undefined ? { email } : {}),
      ...(name !== undefined ? { name } : {}),
      ...(role ? { role } : {}),
      ...(password ? { password: await hashPassword(password) } : {}),
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

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = (() => {
    try {
      return requireSessionFromRequest(_req);
    } catch {
      return null;
    }
  })();
  if (!session) return unauthorized();
  if (!isSuperAdmin(session.role)) return forbidden();

  const { id } = await params;
  if (session.id === id) return badRequest("You cannot delete your own account");

  const target = await prisma.platformUser.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (target.role === "SUPER_ADMIN") {
    const superAdmins = await prisma.platformUser.count({ where: { role: "SUPER_ADMIN" } });
    if (superAdmins <= 1) {
      return badRequest("At least one SUPER_ADMIN must remain");
    }
  }

  await prisma.platformUser.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
