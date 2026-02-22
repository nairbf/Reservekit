import { NextRequest, NextResponse } from "next/server";
import { badRequest, forbidden, unauthorized } from "@/lib/api";
import { requireSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DEFAULT_MARKETING_SETTINGS } from "@/lib/marketing-defaults";
import { isAdminOrSuper } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const normalized: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(value as Record<string, unknown>)) {
    const cleanKey = String(key || "").trim();
    if (!cleanKey) continue;

    if (typeof rawValue === "string") {
      normalized[cleanKey] = rawValue;
      continue;
    }

    if (rawValue === null || rawValue === undefined) {
      normalized[cleanKey] = "";
      continue;
    }

    normalized[cleanKey] = String(rawValue);
  }

  return normalized;
}

function toSettingsObject(rows: Array<{ key: string; value: string }>) {
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

async function seedDefaultsIfNeeded() {
  const count = await prisma.marketingSetting.count();
  if (count > 0) return false;

  console.log("[MARKETING-SETTINGS] Table empty, seeding defaults");
  const entries = Object.entries(DEFAULT_MARKETING_SETTINGS);
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.marketingSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      }),
    ),
  );

  return true;
}

export async function GET(req: NextRequest) {
  let session;
  try {
    session = requireSessionFromRequest(req);
    console.log("[MARKETING-SETTINGS][GET] Authenticated", {
      email: session.email,
      role: session.role,
    });
  } catch {
    console.warn("[MARKETING-SETTINGS][GET] Unauthorized request");
    return unauthorized();
  }

  if (!isAdminOrSuper(session.role)) {
    console.warn("[MARKETING-SETTINGS][GET] Forbidden", {
      email: session.email,
      role: session.role,
    });
    return forbidden();
  }

  try {
    const seeded = await seedDefaultsIfNeeded();

    const rows = await prisma.marketingSetting.findMany({
      orderBy: { key: "asc" },
      select: { key: true, value: true },
    });

    return NextResponse.json({ settings: toSettingsObject(rows), seeded });
  } catch (error) {
    console.error("[MARKETING-SETTINGS][GET] Failed", error);
    return NextResponse.json(
      {
        error: "Failed to load marketing settings",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  let session;
  try {
    session = requireSessionFromRequest(req);
    console.log("[MARKETING-SETTINGS][POST] Authenticated", {
      email: session.email,
      role: session.role,
    });
  } catch {
    console.warn("[MARKETING-SETTINGS][POST] Unauthorized request");
    return unauthorized();
  }

  if (!isAdminOrSuper(session.role)) {
    console.warn("[MARKETING-SETTINGS][POST] Forbidden", {
      email: session.email,
      role: session.role,
    });
    return forbidden();
  }

  let body: { key?: unknown; value?: unknown; settings?: unknown };
  try {
    body = (await req.json()) as { key?: unknown; value?: unknown; settings?: unknown };
  } catch {
    console.warn("[MARKETING-SETTINGS][POST] Invalid JSON body");
    return badRequest("Invalid JSON body");
  }

  const updates: Record<string, string> = {};

  if (body.key !== undefined) {
    const key = String(body.key || "").trim();
    if (!key) return badRequest("key is required when saving a single setting");
    updates[key] = body.value === null || body.value === undefined ? "" : String(body.value);
  }

  const bulk = normalizeRecord(body.settings);
  for (const [key, value] of Object.entries(bulk)) {
    updates[key] = value;
  }

  const entries = Object.entries(updates);
  if (entries.length === 0) {
    return badRequest("Provide either { key, value } or { settings: {...} }");
  }

  console.log("[MARKETING-SETTINGS][POST] Applying updates", {
    keyCount: entries.length,
    keys: entries.map(([key]) => key),
  });

  try {
    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.marketingSetting.upsert({
          where: { key },
          create: { key, value },
          update: { value },
        }),
      ),
    );

    const updatedRows = await prisma.marketingSetting.findMany({
      where: { key: { in: entries.map(([key]) => key) } },
      orderBy: { key: "asc" },
      select: { key: true, value: true },
    });

    return NextResponse.json({ ok: true, settings: toSettingsObject(updatedRows) });
  } catch (error) {
    console.error("[MARKETING-SETTINGS][POST] Failed", error);
    return NextResponse.json(
      {
        error: "Failed to save marketing settings",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
