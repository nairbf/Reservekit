import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { HostingStatus, RestaurantPlan, RestaurantStatus, LicenseEventType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireSessionFromRequest } from "@/lib/auth";
import { isAdminOrSuper } from "@/lib/rbac";
import { badRequest, unauthorized } from "@/lib/api";
import { buildRestaurantDbPath, nextAvailablePort, slugify } from "@/lib/platform";
import { getLatestHealthMap } from "@/lib/overview";
import { createLicenseEvent } from "@/lib/license-events";

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

  return NextResponse.json({
    restaurant,
    provisioningCommand: `./scripts/add-restaurant.sh ${restaurant.slug} "${restaurant.name}" ${adminEmail}`,
  }, { status: 201 });
}
