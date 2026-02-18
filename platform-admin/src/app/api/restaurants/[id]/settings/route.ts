import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import { LicenseEventType } from "@/generated/prisma/client";
import { badRequest, forbidden, unauthorized } from "@/lib/api";
import { requireSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createLicenseEvent } from "@/lib/license-events";
import { isAdminOrSuper } from "@/lib/rbac";
import { resolveRestaurantDbPath } from "@/lib/restaurant-db";

export const runtime = "nodejs";

const SETTINGS_KEYS = [
  "restaurantName",
  "contactEmail",
  "replyToEmail",
  "staffNotificationEmail",
  "staffNotificationsEnabled",
  "timezone",
  "accentColor",
  "slug",
  "phone",
  "address",
  "emailEnabled",
  "emailSendConfirmations",
  "emailSendReminders",
  "emailReminderTiming",
  "largePartyThreshold",
  "tagline",
  "description",
  "heroImageUrl",
  "logoUrl",
  "faviconUrl",
] as const;

const ALLOWED_KEYS = new Set<string>(SETTINGS_KEYS);

function normalizeSettingsInput(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const source = value as Record<string, unknown>;
  const normalized: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(source)) {
    if (!ALLOWED_KEYS.has(key)) continue;
    normalized[key] = String(rawValue ?? "");
  }
  return normalized;
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
    let rows: Array<{ key: string; value: string }> = [];
    try {
      const placeholders = SETTINGS_KEYS.map(() => "?").join(", ");
      rows = db
        .prepare(`SELECT key, value FROM "Setting" WHERE key IN (${placeholders})`)
        .all(...SETTINGS_KEYS) as Array<{ key: string; value: string }>;
    } finally {
      db.close();
    }

    const settings = rows.reduce<Record<string, string>>((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});

    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json(
      { error: "Could not read restaurant settings", details: String(error) },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const body = (await request.json()) as { settings?: Record<string, unknown> };
  const settings = normalizeSettingsInput(body.settings);
  const entries = Object.entries(settings);

  if (entries.length === 0) {
    return badRequest("No valid settings provided");
  }

  const dbPath = resolveRestaurantDbPath(restaurant.slug, restaurant.dbPath);

  try {
    const db = new Database(dbPath);
    const upsert = db.prepare(`
      INSERT INTO "Setting" (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    try {
      const tx = db.transaction((rows: Array<[string, string]>) => {
        for (const [key, value] of rows) {
          upsert.run(key, value);
        }
      });
      tx(entries);
    } finally {
      db.close();
    }

    await createLicenseEvent({
      restaurantId: restaurant.id,
      event: LicenseEventType.SETTINGS_UPDATED,
      details: `Settings updated: ${entries.map(([key]) => key).join(", ")}`,
      performedBy: session.email,
    });

    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json(
      { error: "Could not update restaurant settings", details: String(error) },
      { status: 500 },
    );
  }
}
