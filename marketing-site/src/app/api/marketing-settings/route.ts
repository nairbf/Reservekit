import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveFilePath(raw: string): string {
  if (raw.startsWith("file:")) {
    const stripped = raw.slice(5);
    return path.isAbsolute(stripped) ? stripped : path.resolve(process.cwd(), stripped);
  }
  return raw;
}

function resolvePlatformAdminDbPath(): string {
  const configured = process.env.PLATFORM_ADMIN_DB_PATH?.trim();
  if (configured) {
    return resolveFilePath(configured);
  }

  return path.resolve(process.cwd(), "../platform-admin/prisma/platform-admin.db");
}

function readMarketingSettings(dbPath: string): Record<string, string> {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    const hasTable = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'MarketingSetting' LIMIT 1")
      .get() as { name: string } | undefined;

    if (!hasTable) return {};

    const rows = db.prepare("SELECT key, value FROM MarketingSetting ORDER BY key ASC").all() as Array<{
      key: string;
      value: string;
    }>;

    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  } finally {
    db.close();
  }
}

export async function GET() {
  const dbPath = resolvePlatformAdminDbPath();

  if (!fs.existsSync(dbPath)) {
    return NextResponse.json({ settings: {} });
  }

  try {
    const settings = readMarketingSettings(dbPath);
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("[marketing-settings] failed to read settings", error);
    return NextResponse.json({ settings: {} });
  }
}
