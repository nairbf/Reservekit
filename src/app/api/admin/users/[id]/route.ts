import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireMasterAdmin } from "@/lib/auth";

const ALLOWED_ROLES = new Set(["superadmin", "admin", "manager", "host"]);

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireMasterAdmin(); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

  const { id } = await params;
  const userId = parseInt(id, 10);
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const body = await req.json();
  const updates: { name?: string; role?: string; isActive?: boolean; passwordHash?: string } = {};

  if (body.name !== undefined) {
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    updates.name = name;
  }

  if (body.role !== undefined) {
    const role = String(body.role || "").trim().toLowerCase();
    if (!ALLOWED_ROLES.has(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    updates.role = role;
  }

  if (body.isActive !== undefined) {
    updates.isActive = Boolean(body.isActive);
  }

  if (body.password !== undefined) {
    const password = String(body.password || "");
    if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    updates.passwordHash = await bcrypt.hash(password, 12);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  if (session.userId === userId && updates.isActive === false) {
    return NextResponse.json({ error: "You cannot deactivate your own account" }, { status: 400 });
  }

  const current = await prisma.user.findUnique({ where: { id: userId } });
  if (!current) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const user = await prisma.user.update({
    where: { id: userId },
    data: updates,
    select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
  });

  return NextResponse.json(user);
}
