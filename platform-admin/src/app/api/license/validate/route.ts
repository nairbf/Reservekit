import { NextRequest, NextResponse } from "next/server";
import { LicenseEventType, RestaurantStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { createLicenseEvent } from "@/lib/license-events";

export const runtime = "nodejs";

function isBlockedStatus(status: RestaurantStatus) {
  return status === "SUSPENDED" || status === "CANCELLED";
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

  return NextResponse.json({
    valid: true,
    status: restaurant.status,
    plan: restaurant.plan,
    restaurantName: restaurant.name,
    features: {
      sms: restaurant.addonSms,
      floorPlan: restaurant.addonFloorPlan,
      reporting: restaurant.addonReporting,
      guestHistory: restaurant.addonGuestHistory,
      eventTicketing: restaurant.addonEventTicketing,
    },
    expiresAt: restaurant.licenseExpiry?.toISOString() || null,
  });
}
