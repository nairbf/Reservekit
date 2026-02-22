import { NextRequest, NextResponse } from "next/server";
import { LicenseEventType, RestaurantPlan, RestaurantStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { createLicenseEvent } from "@/lib/license-events";

export const runtime = "nodejs";

function isBlockedStatus(status: RestaurantStatus) {
  return status === "SUSPENDED" || status === "CANCELLED";
}

function planFeatures(plan: RestaurantPlan) {
  if (plan === "FULL_SUITE") {
    return {
      sms: true,
      floorPlan: true,
      reporting: true,
      guestHistory: true,
      eventTicketing: true,
    };
  }
  if (plan === "SERVICE_PRO") {
    return {
      sms: true,
      floorPlan: true,
      reporting: true,
      guestHistory: false,
      eventTicketing: false,
    };
  }
  return {
    sms: false,
    floorPlan: false,
    reporting: false,
    guestHistory: false,
    eventTicketing: false,
  };
}

export async function POST(request: NextRequest) {
  let licenseKey = "";
  try {
    const body = (await request.json()) as { licenseKey?: string };
    licenseKey = String(body?.licenseKey || "").trim();
  } catch {
    return NextResponse.json({ valid: false, error: "Invalid request body" }, { status: 400 });
  }

  if (!licenseKey) {
    return NextResponse.json({ valid: false, error: "licenseKey is required" }, { status: 400 });
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { licenseKey },
  });

  if (!restaurant) {
    return NextResponse.json({ valid: false, error: "Invalid license key" }, { status: 401 });
  }

  if (isBlockedStatus(restaurant.status)) {
    return NextResponse.json(
      {
        valid: false,
        status: restaurant.status,
        error: "License suspended",
      },
      { status: 403 },
    );
  }

  if (restaurant.licenseExpiry && restaurant.licenseExpiry.getTime() < Date.now()) {
    return NextResponse.json(
      {
        valid: false,
        status: restaurant.status,
        error: "License expired",
      },
      { status: 403 },
    );
  }

  await createLicenseEvent({
    restaurantId: restaurant.id,
    event: LicenseEventType.LICENSE_VALIDATED,
    details: "License validated by restaurant app",
    performedBy: "system",
  });

  const baseFeatures = planFeatures(restaurant.plan);
  const addOns = {
    sms: Boolean(restaurant.addonSms),
    floorPlan: Boolean(restaurant.addonFloorPlan),
    reporting: Boolean(restaurant.addonReporting),
    guestHistory: Boolean(restaurant.addonGuestHistory),
    eventTicketing: Boolean(restaurant.addonEventTicketing),
  };
  const features = {
    sms: baseFeatures.sms || addOns.sms,
    floorPlan: baseFeatures.floorPlan || addOns.floorPlan,
    reporting: baseFeatures.reporting || addOns.reporting,
    guestHistory: baseFeatures.guestHistory || addOns.guestHistory,
    eventTicketing: baseFeatures.eventTicketing || addOns.eventTicketing,
  };
  const enabledAddons = Object.entries(addOns)
    .filter(([, enabled]) => enabled)
    .map(([key]) => key);

  return NextResponse.json({
    valid: true,
    status: restaurant.status,
    plan: restaurant.plan,
    restaurantName: restaurant.name,
    features,
    addons: addOns,
    enabledAddons,
    expiresAt: restaurant.licenseExpiry?.toISOString() || null,
  });
}
