import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { buildPermissionOverrides, getPermissionKeys, type PermissionKey } from "@/lib/permissions";

const ALLOWED_ROLES = new Set(["superadmin", "admin", "manager", "host"]);
const PERMISSION_KEYS = new Set(getPermissionKeys());

function parseSelectedPermissions(value: unknown): PermissionKey[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => String(entry || "").trim())
    .filter((entry): entry is PermissionKey => PERMISSION_KEYS.has(entry as PermissionKey));
}

export async function GET() {
  try { await requirePermission("manage_staff"); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      permissions: true,
      isActive: true,
      createdAt: true,
    },
  });

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  try { await requirePermission("manage_staff"); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

  const body = await req.json();
  const name = String(body?.name || "").trim();
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  const role = String(body?.role || "admin").trim().toLowerCase();

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  if (!ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already exists" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const selectedPermissions = parseSelectedPermissions(body?.permissions);
  const permissionOverrides = buildPermissionOverrides(role, selectedPermissions);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role, permissions: permissionOverrides, isActive: true },
    select: { id: true, email: true, name: true, role: true, permissions: true, isActive: true, createdAt: true },
  });

  return NextResponse.json(user, { status: 201 });
}
