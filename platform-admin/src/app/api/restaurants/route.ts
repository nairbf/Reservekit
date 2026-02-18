import { randomUUID } from "crypto";
import { existsSync } from "fs";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { HostingStatus, RestaurantPlan, RestaurantStatus, LicenseEventType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireSessionFromRequest } from "@/lib/auth";
import { isAdminOrSuper } from "@/lib/rbac";
import { badRequest, unauthorized } from "@/lib/api";
import { buildRestaurantDbPath, nextAvailablePort, slugify } from "@/lib/platform";
import { getLatestHealthMap } from "@/lib/overview";
import { createLicenseEvent } from "@/lib/license-events";
import { resolveRestaurantDbPath } from "@/lib/restaurant-db";

function parsePlan(value: string | null): RestaurantPlan | null {
  if (!value) return null;
  if (value === "CORE" || value === "SERVICE_PRO" || value === "FULL_SUITE") return value;
  return null;
}

function parseStatus(value: string | null): RestaurantStatus | null {
  if (!value) return null;
  if (value === "ACTIVE" || value === "SUSPENDED" || value === "TRIAL" || value === "CANCELLED") return value;
  return null;
}

function parseHostingStatus(value: string | null): HostingStatus | null {
  if (!value) return null;
  if (value === "ACTIVE" || value === "SUSPENDED" || value === "SELF_HOSTED") return value;
  return null;
}

function normalizeAddons(plan: RestaurantPlan, body: Record<string, unknown>) {
  const base = {
    addonSms: Boolean(body.addonSms),
    addonFloorPlan: Boolean(body.addonFloorPlan),
    addonReporting: Boolean(body.addonReporting),
    addonGuestHistory: Boolean(body.addonGuestHistory),
    addonEventTicketing: Boolean(body.addonEventTicketing),
  };

  if (plan === "SERVICE_PRO") {
    base.addonSms = true;
    base.addonFloorPlan = true;
    base.addonReporting = true;
  }

  if (plan === "FULL_SUITE") {
    base.addonSms = true;
    base.addonFloorPlan = true;
    base.addonReporting = true;
    base.addonGuestHistory = true;
    base.addonEventTicketing = true;
  }

  return base;
}

function normalizeTimezone(value: unknown) {
  const raw = String(value || "").trim();
  return raw || "America/New_York";
}

async function seedRestaurantDatabase(options: {
  dbPath: string;
  name: string;
  slug: string;
  ownerName: string | null;
  ownerEmail: string;
  notificationEmail: string;
  phone: string | null;
  address: string | null;
  timezone: string;
  initialPassword: string;
}) {
  const db = new Database(options.dbPath);
  try {
    const tableRows = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('Setting', 'User') ORDER BY name ASC",
      )
      .all() as Array<{ name: string }>;
    const tableSet = new Set(tableRows.map((row) => row.name));
    if (!tableSet.has("Setting") || !tableSet.has("User")) {
      throw new Error("Restaurant database missing required tables (Setting/User)");
    }

    const settingEntries: Record<string, string> = {
      restaurantName: options.name,
      contactEmail: options.ownerEmail,
      replyToEmail: options.notificationEmail,
      staffNotificationEmail: options.notificationEmail,
      staffNotificationsEnabled: "true",
      emailEnabled: "true",
      emailSendConfirmations: "true",
      emailSendReminders: "true",
      emailReminderTiming: "24",
      timezone: options.timezone,
      phone: options.phone || "",
      address: options.address || "",
      slug: options.slug,
    };

    const upsertSetting = db.prepare(`
      INSERT INTO "Setting" (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    const tx = db.transaction((entries: Array<[string, string]>) => {
      for (const [key, value] of entries) {
        upsertSetting.run(key, value);
      }
    });

    tx(Object.entries(settingEntries));

    const existing = db
      .prepare('SELECT id FROM "User" WHERE email = ? LIMIT 1')
      .get(options.ownerEmail) as { id: number } | undefined;

    let userCreated = false;
    if (!existing) {
      const passwordHash = await bcrypt.hash(options.initialPassword, 12);
      const now = new Date().toISOString();
      db.prepare(
        'INSERT INTO "User" (email, name, passwordHash, role, isActive, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(
        options.ownerEmail,
        options.ownerName || `${options.name} Admin`,
        passwordHash,
        "admin",
        1,
        now,
      );
      userCreated = true;
    }

    return {
      settingsSeeded: true,
      userCreated,
    };
  } finally {
    db.close();
  }
}

export async function GET(req: NextRequest) {
  try {
    requireSessionFromRequest(req);
  } catch {
    return unauthorized();
  }

  const { searchParams } = new URL(req.url);
  const search = String(searchParams.get("search") || "").trim();
  const plan = parsePlan(searchParams.get("plan"));
  const status = parseStatus(searchParams.get("status"));

  const rows = await prisma.restaurant.findMany({
    where: {
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { slug: { contains: search } },
              { ownerEmail: { contains: search } },
              { adminEmail: { contains: search } },
            ],
          }
        : {}),
      ...(plan ? { plan } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
  });

  const latestHealth = await getLatestHealthMap();

  return NextResponse.json(
    rows.map((row) => ({
      ...row,
      health: latestHealth.get(row.id) || null,
    })),
  );
}

export async function POST(req: NextRequest) {
  let session;
  try {
    session = requireSessionFromRequest(req);
  } catch {
    return unauthorized();
  }

  if (!isAdminOrSuper(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const slug = slugify(String(body.slug || ""));
  const name = String(body.name || "").trim();
  const adminEmail = String(body.adminEmail || body.ownerEmail || "").trim().toLowerCase();
  const ownerEmail = String(body.ownerEmail || body.adminEmail || "").trim().toLowerCase();
  const ownerName = body.ownerName ? String(body.ownerName).trim() : null;
  const ownerPhone = body.ownerPhone ? String(body.ownerPhone).trim() : null;
  const restaurantPhone = body.phone ? String(body.phone).trim() : null;
  const restaurantAddress = body.address ? String(body.address).trim() : null;
  const notificationEmail = String(body.notificationEmail || ownerEmail || adminEmail)
    .trim()
    .toLowerCase();
  const timezone = normalizeTimezone(body.timezone);
  const initialPassword = String(body.initialPassword || "");
  const domain = body.domain ? String(body.domain).trim() : `${slug}.reservesit.com`;

  const plan = parsePlan(String(body.plan || "CORE")) || RestaurantPlan.CORE;
  const status = parseStatus(String(body.status || "TRIAL")) || RestaurantStatus.TRIAL;
  const hosted = body.hosted === undefined ? true : Boolean(body.hosted);
  const hostingStatus =
    parseHostingStatus(String(body.hostingStatus || "")) ||
    (hosted ? HostingStatus.ACTIVE : HostingStatus.SELF_HOSTED);
  const monthlyHostingActive = body.monthlyHostingActive === undefined ? hosted : Boolean(body.monthlyHostingActive);
  const notes = body.notes ? String(body.notes) : null;

  if (!slug || !name || !adminEmail) {
    return badRequest("slug, name, and adminEmail (or ownerEmail) are required");
  }

  if (initialPassword && initialPassword.length < 8) {
    return badRequest("Initial password must be at least 8 characters");
  }

  const existing = await prisma.restaurant.findFirst({
    where: {
      OR: [{ slug }],
    },
  });
  if (existing?.slug === slug) return NextResponse.json({ error: "Slug already in use" }, { status: 409 });

  const parsedPort = Number(body.port);
  const port = Number.isFinite(parsedPort) && parsedPort > 0 ? Math.trunc(parsedPort) : await nextAvailablePort(3001);
  const dbPath = body.dbPath ? String(body.dbPath) : buildRestaurantDbPath(slug);
  const licenseKey = randomUUID();

  const trialEndsAt =
    status === RestaurantStatus.TRIAL
      ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 14)
      : null;

  const addons = normalizeAddons(plan, body);

  const restaurant = await prisma.restaurant.create({
    data: {
      slug,
      name,
      domain,
      adminEmail,
      ownerEmail,
      ownerName,
      ownerPhone,
      status,
      plan,
      port,
      dbPath,
      licenseKey,
      hosted,
      hostingStatus,
      monthlyHostingActive,
      trialEndsAt,
      notes,
      ...addons,
    },
  });

  await createLicenseEvent({
    restaurantId: restaurant.id,
    event: LicenseEventType.LICENSE_CREATED,
    details: `Restaurant provisioned on port ${restaurant.port}`,
    performedBy: session.email,
  });

  const dbPathResolved = resolveRestaurantDbPath(restaurant.slug, restaurant.dbPath);
  let seededRestaurantDb = false;
  let adminUserCreated = false;
  let seedSkipped = false;
  let seedError: string | null = null;

  if (!existsSync(dbPathResolved)) {
    seedSkipped = true;
  } else if (!initialPassword) {
    seedError = "Initial password missing; skipped restaurant DB user setup.";
  } else {
    try {
      const seeded = await seedRestaurantDatabase({
        dbPath: dbPathResolved,
        name: restaurant.name,
        slug: restaurant.slug,
        ownerName,
        ownerEmail,
        notificationEmail,
        phone: restaurantPhone,
        address: restaurantAddress,
        timezone,
        initialPassword,
      });
      seededRestaurantDb = seeded.settingsSeeded;
      adminUserCreated = seeded.userCreated;

      await createLicenseEvent({
        restaurantId: restaurant.id,
        event: LicenseEventType.SETTINGS_UPDATED,
        details: `Initial onboarding settings synced to ${dbPathResolved}`,
        performedBy: session.email,
      });
    } catch (error) {
      seedError = error instanceof Error ? error.message : "Failed to seed restaurant database";
    }
  }

  return NextResponse.json({
    restaurant,
    provisioningCommand: `./scripts/add-restaurant.sh ${restaurant.slug} "${restaurant.name}" ${adminEmail}`,
    seededRestaurantDb,
    adminUserCreated,
    seedSkipped,
    seedError,
  }, { status: 201 });
}
