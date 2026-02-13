import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { LicenseEventType } from "@/generated/prisma/client";
import { requireSessionFromRequest } from "@/lib/auth";
import { badRequest, forbidden, unauthorized } from "@/lib/api";
import { prisma } from "@/lib/db";
import { createLicenseEvent } from "@/lib/license-events";
import { isAdminOrSuper } from "@/lib/rbac";
import { resolveRestaurantDbPath } from "@/lib/restaurant-db";

export const runtime = "nodejs";

function normalizeRole(value: unknown) {
  const role = String(value || "manager").trim().toLowerCase();
  if (role === "admin" || role === "manager" || role === "host") return role;
  return "manager";
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const session = (() => {
    try {
      return requireSessionFromRequest(request);
    } catch {
      return null;
    }
  })();

  if (!session) return unauthorized();
  if (!isAdminOrSuper(session.role)) return forbidden();

  const { id, userId } = await params;
  const userIdNum = Number(userId);
  if (!Number.isFinite(userIdNum) || userIdNum <= 0) return badRequest("Invalid user id");

  const restaurant = await prisma.restaurant.findUnique({ where: { id } });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await request.json()) as {
    email?: string;
    name?: string;
    role?: string;
    password?: string;
    isActive?: boolean;
  };

  const email = body.email !== undefined ? String(body.email).trim().toLowerCase() : undefined;
  const name = body.name !== undefined ? String(body.name).trim() : undefined;
  const role = body.role !== undefined ? normalizeRole(body.role) : undefined;
  const password = body.password !== undefined ? String(body.password) : undefined;
  const isActive = body.isActive !== undefined ? Boolean(body.isActive) : undefined;

  if (password !== undefined && password.length > 0 && password.length < 8) {
    return badRequest("Password must be at least 8 characters");
  }

  const dbPath = resolveRestaurantDbPath(restaurant.slug, restaurant.dbPath);

  try {
    const db = new Database(dbPath);

    const existing = db
      .prepare('SELECT id, email, name, role, isActive FROM "User" WHERE id = ? LIMIT 1')
      .get(userIdNum) as { id: number; email: string; name: string; role: string; isActive: number } | undefined;

    if (!existing) {
      db.close();
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (email && email !== existing.email) {
      const collision = db
        .prepare('SELECT id FROM "User" WHERE email = ? AND id != ? LIMIT 1')
        .get(email, userIdNum) as { id: number } | undefined;
      if (collision) {
        db.close();
        return NextResponse.json({ error: "Email already in use" }, { status: 409 });
      }
    }

    const updates: string[] = [];
    const values: Array<string | number> = [];

    if (email !== undefined) {
      updates.push("email = ?");
      values.push(email);
    }

    if (name !== undefined) {
      updates.push("name = ?");
      values.push(name);
    }

    if (role !== undefined) {
      updates.push("role = ?");
      values.push(role);
    }

    if (isActive !== undefined) {
      updates.push("isActive = ?");
      values.push(isActive ? 1 : 0);
    }

    if (password && password.length > 0) {
      const passwordHash = await bcrypt.hash(password, 12);
      updates.push("passwordHash = ?");
      values.push(passwordHash);
    }

    if (updates.length === 0) {
      db.close();
      return badRequest("No fields provided to update");
    }

    values.push(userIdNum);

    db.prepare(`UPDATE "User" SET ${updates.join(", ")} WHERE id = ?`).run(...values);

    const updated = db
      .prepare('SELECT id, email, name, role, isActive, createdAt FROM "User" WHERE id = ?')
      .get(userIdNum) as { email?: string } | undefined;

    db.close();

    await createLicenseEvent({
      restaurantId: restaurant.id,
      event: LicenseEventType.USER_UPDATED,
      details: `User ${updated?.email || userId} updated by ${session.email}`,
      performedBy: session.email,
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    return NextResponse.json(
      { error: "Could not update user", details: String(error) },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const session = (() => {
    try {
      return requireSessionFromRequest(request);
    } catch {
      return null;
    }
  })();

  if (!session) return unauthorized();
  if (!isAdminOrSuper(session.role)) return forbidden();

  const { id, userId } = await params;
  const userIdNum = Number(userId);
  if (!Number.isFinite(userIdNum) || userIdNum <= 0) return badRequest("Invalid user id");

  const restaurant = await prisma.restaurant.findUnique({ where: { id } });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const dbPath = resolveRestaurantDbPath(restaurant.slug, restaurant.dbPath);

  try {
    const db = new Database(dbPath);

    const existing = db
      .prepare('SELECT id, email FROM "User" WHERE id = ? LIMIT 1')
      .get(userIdNum) as { id: number; email: string } | undefined;

    if (!existing) {
      db.close();
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    db.prepare('DELETE FROM "User" WHERE id = ?').run(userIdNum);
    db.close();

    await createLicenseEvent({
      restaurantId: restaurant.id,
      event: LicenseEventType.USER_DELETED,
      details: `User ${existing.email} deleted by ${session.email}`,
      performedBy: session.email,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Could not delete user", details: String(error) },
      { status: 500 },
    );
  }
}
