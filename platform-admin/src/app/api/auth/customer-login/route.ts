import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveRestaurantDbPath } from "@/lib/restaurant-db";

export const runtime = "nodejs";

type LoginRequestBody = {
  email?: string;
  password?: string;
};

type RestaurantDbUser = {
  id: number | string;
  email: string;
  name: string | null;
  passwordHash: string;
  role: string | null;
};

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-webhook-secret")?.trim();
  const expectedSecret = process.env.PLATFORM_WEBHOOK_SECRET?.trim();
  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: LoginRequestBody;
  try {
    body = (await request.json()) as LoginRequestBody;
  } catch {
    return NextResponse.json({ error: "Credentials required" }, { status: 400 });
  }

  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");

  if (!email || !password) {
    return NextResponse.json({ error: "Credentials required" }, { status: 400 });
  }

  const restaurant = await prisma.restaurant.findFirst({
    where: {
      OR: [{ ownerEmail: email }, { adminEmail: email }],
      status: { not: "CANCELLED" },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!restaurant) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const dbPath = resolveRestaurantDbPath(restaurant.slug, restaurant.dbPath);

  try {
    const db = new Database(dbPath, { readonly: true });
    const user = db
      .prepare(
        'SELECT id, email, name, passwordHash, role FROM "User" WHERE lower(email) = ? AND coalesce(isActive, 1) = 1 LIMIT 1',
      )
      .get(email) as RestaurantDbUser | undefined;
    db.close();

    if (!user?.passwordHash) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    return NextResponse.json({
      id: restaurant.id,
      email: user.email,
      name: user.name || restaurant.ownerName || email.split("@")[0],
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      slug: restaurant.slug,
      plan: restaurant.plan,
      status: restaurant.status,
    });
  } catch (error) {
    console.error("[CUSTOMER LOGIN] DB error:", error);
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
}
