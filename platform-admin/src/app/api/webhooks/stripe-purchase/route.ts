import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { LicenseEventType, RestaurantPlan, RestaurantStatus, HostingStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { createPurchaseSequence } from "@/lib/email-sequences";
import { createLicenseEvent } from "@/lib/license-events";
import { buildRestaurantDbPath, nextAvailablePort, slugify as slugifyBase } from "@/lib/platform";

export const runtime = "nodejs";

function parsePlan(plan: unknown): RestaurantPlan {
  const value = String(plan || "").trim();
  if (value === "CORE" || value === "SERVICE_PRO" || value === "FULL_SUITE") return value;
  if (value === "core") return "CORE";
  if (value === "servicePro" || value === "service_pro") return "SERVICE_PRO";
  if (value === "fullSuite" || value === "full_suite") return "FULL_SUITE";
  return "CORE";
}

function parseAddons(raw: unknown) {
  const value = String(raw || "").trim();
  let parts: string[] = [];

  if (value) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        parts = parsed.map((part) => String(part || "").trim()).filter(Boolean);
      } else if (typeof parsed === "string") {
        parts = parsed.split(",").map((part) => part.trim()).filter(Boolean);
      }
    } catch {
      parts = value.split(",").map((part) => part.trim()).filter(Boolean);
    }
  }

  const set = new Set(parts);
  return {
    addonSms: set.has("sms"),
    addonFloorPlan: set.has("floorPlan"),
    addonReporting: set.has("reporting"),
    addonGuestHistory: set.has("guestHistory"),
    addonEventTicketing: set.has("eventTicketing"),
  };
}

function normalizePlanAddons(plan: RestaurantPlan, addons: ReturnType<typeof parseAddons>) {
  const next = { ...addons };
  if (plan === "SERVICE_PRO" || plan === "FULL_SUITE") {
    next.addonSms = true;
    next.addonFloorPlan = true;
    next.addonReporting = true;
  }
  if (plan === "FULL_SUITE") {
    next.addonGuestHistory = true;
    next.addonEventTicketing = true;
  }
  return next;
}

function parseHosting(hosting: unknown) {
  const value = String(hosting || "").trim().toLowerCase();
  const managed = value === "monthly" || value === "annual" || value === "true";
  return {
    hosted: managed,
    hostingStatus: managed ? HostingStatus.ACTIVE : HostingStatus.SELF_HOSTED,
    monthlyHostingActive: managed,
  };
}

async function uniqueSlug(baseName: string) {
  const base = slugifyBase(baseName) || "restaurant";
  let candidate = base.slice(0, 30);
  let attempt = 1;

  while (true) {
    const exists = await prisma.restaurant.findUnique({ where: { slug: candidate } });
    if (!exists) return candidate;
    attempt += 1;
    const suffix = `-${attempt}`;
    candidate = `${base.slice(0, Math.max(1, 30 - suffix.length))}${suffix}`;
  }
}

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.PLATFORM_WEBHOOK_SECRET;
  const receivedSecret = request.headers.get("X-Webhook-Secret");
  if (!expectedSecret || expectedSecret.trim() === "") {
    console.error("[STRIPE-PURCHASE] PLATFORM_WEBHOOK_SECRET is not set — rejecting request");
    return NextResponse.json({ error: "Webhook secret not configured on server" }, { status: 500 });
  }
  if (receivedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    email?: string;
    name?: string;
    restaurantName?: string;
    plan?: string;
    addons?: string;
    hosting?: string;
    amountTotal?: number;
    stripeSessionId?: string;
    stripeCustomerId?: string;
  };

  const email = String(body.email || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const ownerName = String(body.name || "").trim() || email.split("@")[0];
  const restaurantName = String(body.restaurantName || "").trim() || "New Restaurant";
  const stripeSessionId = String(body.stripeSessionId || "").trim();
  const stripeCustomerId = String(body.stripeCustomerId || "").trim();
  const parsedPlan = parsePlan(body.plan);
  const addons = normalizePlanAddons(parsedPlan, parseAddons(body.addons));
  const hosting = parseHosting(body.hosting);

  if (stripeSessionId) {
    const existingBySession = await prisma.restaurant.findFirst({
      where: { notes: { contains: stripeSessionId } },
    });
    if (existingBySession) {
      return NextResponse.json({ message: "Restaurant already exists for session", id: existingBySession.id });
    }
  }

  if (stripeCustomerId) {
    const existingByCustomer = await prisma.restaurant.findFirst({
      where: { stripeCustomerId },
    });
    if (existingByCustomer) {
      return NextResponse.json({ message: "Restaurant already exists for customer", id: existingByCustomer.id });
    }
  }

  const slug = await uniqueSlug(restaurantName);
  const port = await nextAvailablePort(3001);
  const licenseKey = randomUUID();
  const instanceUrl = hosting.hosted ? `https://${slug}.reservesit.com` : "self-hosted";

  if (stripeSessionId) {
    const existing = await prisma.restaurant.findFirst({
      where: { notes: { contains: `Session: ${stripeSessionId}` } },
      select: { id: true, slug: true, licenseKey: true },
    });
    if (existing) {
      console.log("[STRIPE-PURCHASE] Idempotent — already provisioned for session", stripeSessionId);
      return NextResponse.json({
        message: "Already provisioned (idempotent)",
        id: existing.id,
        slug: existing.slug,
        licenseKey: existing.licenseKey,
      });
    }
  }

  const restaurant = await prisma.restaurant.create({
    data: {
      slug,
      name: restaurantName,
      domain: `${slug}.reservesit.com`,
      adminEmail: email,
      ownerName,
      ownerEmail: email,
      status: RestaurantStatus.ACTIVE,
      plan: parsedPlan,
      port,
      dbPath: buildRestaurantDbPath(slug),
      licenseKey,
      licenseActivatedAt: new Date(),
      stripeCustomerId: stripeCustomerId || null,
      oneTimeRevenue: Number.isFinite(Number(body.amountTotal)) ? Number(body.amountTotal) : null,
      notes: `Auto-created from Stripe purchase. Session: ${stripeSessionId || "N/A"}`,
      ...hosting,
      ...addons,
    },
  });

  await createLicenseEvent({
    restaurantId: restaurant.id,
    event: LicenseEventType.LICENSE_CREATED,
    details: `Auto-created from Stripe webhook. Plan=${parsedPlan}`,
    performedBy: "stripe-webhook",
  });

  await createLicenseEvent({
    restaurantId: restaurant.id,
    event: LicenseEventType.ACTIVATED,
    details: `License activated. Amount=$${((Number(body.amountTotal) || 0) / 100).toFixed(2)}`,
    performedBy: "stripe-webhook",
  });

  await createPurchaseSequence({
    restaurantId: restaurant.id,
    ownerName,
    ownerEmail: email,
    restaurantName,
    plan: parsedPlan,
    licenseKey,
    instanceUrl,
    hosted: hosting.hosted,
  });

  return NextResponse.json({
    message: "Restaurant created and purchase sequence queued",
    id: restaurant.id,
    slug,
    licenseKey,
  });
}
