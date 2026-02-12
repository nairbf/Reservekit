import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { RestaurantPlan, RestaurantStatus, LicenseEventType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireSessionFromRequest } from "@/lib/auth";
import { isAdminOrSuper } from "@/lib/rbac";
import { badRequest, unauthorized } from "@/lib/api";
import { buildRestaurantDbPath, nextAvailablePort, slugify } from "@/lib/platform";
import { getLatestHealthMap } from "@/lib/overview";

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

  const body = await req.json();
  const slug = slugify(String(body?.slug || ""));
  const name = String(body?.name || "").trim();
  const adminEmail = String(body?.adminEmail || "").trim().toLowerCase();
  const plan = parsePlan(String(body?.plan || "CORE")) || RestaurantPlan.CORE;
  const status = parseStatus(String(body?.status || "TRIAL")) || RestaurantStatus.TRIAL;
  const monthlyHostingActive = Boolean(body?.monthlyHostingActive);
  const notes = body?.notes ? String(body.notes) : null;

  if (!slug || !name || !adminEmail) {
    return badRequest("slug, name, and adminEmail are required");
  }

  const existing = await prisma.restaurant.findFirst({
    where: {
      OR: [{ slug }, { adminEmail }],
    },
  });
  if (existing?.slug === slug) return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
  if (existing?.adminEmail === adminEmail) {
    return NextResponse.json({ error: "Admin email already in use" }, { status: 409 });
  }

  const port = await nextAvailablePort(3001);
  const dbPath = buildRestaurantDbPath(slug);
  const licenseKey = randomUUID();

  const trialEndsAt =
    status === RestaurantStatus.TRIAL
      ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 14)
      : null;

  const restaurant = await prisma.restaurant.create({
    data: {
      slug,
      name,
      adminEmail,
      status,
      plan,
      port,
      dbPath,
      licenseKey,
      monthlyHostingActive,
      trialEndsAt,
      notes,
    },
  });

  await prisma.licenseEvent.create({
    data: {
      restaurantId: restaurant.id,
      event: LicenseEventType.CREATED,
      details: `Restaurant created on port ${restaurant.port}`,
      performedBy: session.email,
    },
  });

  return NextResponse.json({
    restaurant,
    provisioningCommand: `./scripts/add-restaurant.sh ${restaurant.slug} "${restaurant.name}" ${restaurant.adminEmail}`,
  }, { status: 201 });
}
