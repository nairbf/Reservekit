import { NextRequest, NextResponse } from "next/server";
import { badRequest, forbidden, unauthorized } from "@/lib/api";
import { requireSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
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

export async function GET(req: NextRequest) {
  let session;
  try {
    session = requireSessionFromRequest(req);
  } catch {
    return unauthorized();
  }

  if (!isAdminOrSuper(session.role)) return forbidden();

  const rows = await prisma.marketingSetting.findMany({
    orderBy: { key: "asc" },
    select: { key: true, value: true },
  });

  return NextResponse.json({ settings: toSettingsObject(rows) });
}

export async function POST(req: NextRequest) {
  let session;
  try {
    session = requireSessionFromRequest(req);
  } catch {
    return unauthorized();
  }

  if (!isAdminOrSuper(session.role)) return forbidden();

  const body = (await req.json().catch(() => null)) as
    | { key?: unknown; value?: unknown; settings?: unknown }
    | null;

  if (!body) return badRequest("Invalid request body");

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
}
