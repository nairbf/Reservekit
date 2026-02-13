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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSessionFromRequest(request);
  } catch {
    return unauthorized();
  }

  const { id } = await params;
  const restaurant = await prisma.restaurant.findUnique({ where: { id } });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const dbPath = resolveRestaurantDbPath(restaurant.slug, restaurant.dbPath);

  try {
    const db = new Database(dbPath, { readonly: true });
    const users = db
      .prepare('SELECT id, email, name, role, isActive, createdAt FROM "User" ORDER BY createdAt DESC')
      .all();
    db.close();

    return NextResponse.json({ users });
  } catch (error) {
    return NextResponse.json(
      { error: "Could not read restaurant database", details: String(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = (() => {
    try {
      return requireSessionFromRequest(request);
    } catch {
      return null;
    }
  })();

  if (!session) return unauthorized();
  if (!isAdminOrSuper(session.role)) return forbidden();

  const { id } = await params;
  const restaurant = await prisma.restaurant.findUnique({ where: { id } });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await request.json()) as {
    email?: string;
    name?: string;
    password?: string;
    role?: string;
  };

  const email = String(body.email || "").trim().toLowerCase();
  const name = String(body.name || "").trim();
  const password = String(body.password || "");
  const role = normalizeRole(body.role);

  if (!email || !name || !password) {
    return badRequest("Email, name, and password are required");
  }

  if (password.length < 8) {
    return badRequest("Password must be at least 8 characters");
  }

  const dbPath = resolveRestaurantDbPath(restaurant.slug, restaurant.dbPath);

  try {
    const db = new Database(dbPath);

    const existing = db
      .prepare('SELECT id FROM "User" WHERE email = ? LIMIT 1')
      .get(email) as { id: number } | undefined;
    if (existing) {
      db.close();
      return NextResponse.json({ error: "User email already exists" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date().toISOString();

    const result = db
      .prepare(
        'INSERT INTO "User" (email, name, passwordHash, role, isActive, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(email, name, passwordHash, role, 1, now);

    const idValue = Number(result.lastInsertRowid);
    const user = db
      .prepare('SELECT id, email, name, role, isActive, createdAt FROM "User" WHERE id = ?')
      .get(idValue);

    db.close();

    await createLicenseEvent({
      restaurantId: restaurant.id,
      event: LicenseEventType.USER_CREATED,
      details: `User ${email} created by ${session.email}`,
      performedBy: session.email,
    });

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json(
      { error: "Could not create user", details: String(error) },
      { status: 500 },
    );
  }
}
