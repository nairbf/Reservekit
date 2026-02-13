import { NextRequest, NextResponse } from "next/server";
import { LicenseEventType } from "@/generated/prisma/client";
import { requireSessionFromRequest } from "@/lib/auth";
import { badRequest, forbidden, unauthorized } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdminOrSuper } from "@/lib/rbac";
import { AddonKey, AddonState, syncAddonsToRestaurantDb } from "@/lib/restaurant-db";
import { createLicenseEvent, createLicenseEvents } from "@/lib/license-events";

const ADDON_KEYS: AddonKey[] = [
  "addonSms",
  "addonFloorPlan",
  "addonReporting",
  "addonGuestHistory",
  "addonEventTicketing",
];

function addonLabel(key: AddonKey): string {
  if (key === "addonSms") return "SMS";
  if (key === "addonFloorPlan") return "Floor Plan";
  if (key === "addonReporting") return "Reporting";
  if (key === "addonGuestHistory") return "Guest History";
  return "Event Ticketing";
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = (() => {
    try {
      return requireSessionFromRequest(req);
    } catch {
      return null;
    }
  })();

  if (!session) return unauthorized();
  if (!isAdminOrSuper(session.role)) return forbidden();

  const { id } = await params;
  const current = await prisma.restaurant.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as Partial<Record<AddonKey, unknown>>;
  const patch: Partial<Record<AddonKey, boolean>> = {};

  for (const key of ADDON_KEYS) {
    if (body[key] !== undefined) patch[key] = Boolean(body[key]);
  }

  if (Object.keys(patch).length === 0) {
    return badRequest("At least one add-on field is required");
  }

  const updated = await prisma.restaurant.update({
    where: { id },
    data: patch,
  });

  const eventInputs = ADDON_KEYS
    .filter((key) => patch[key] !== undefined && patch[key] !== current[key])
    .map((key) => ({
      restaurantId: id,
      event: patch[key] ? LicenseEventType.ADDON_ENABLED : LicenseEventType.ADDON_DISABLED,
      details: `${addonLabel(key)} ${patch[key] ? "enabled" : "disabled"}`,
      performedBy: session.email,
    }));

  const events = await createLicenseEvents(eventInputs);

  const addonState: AddonState = {
    addonSms: updated.addonSms,
    addonFloorPlan: updated.addonFloorPlan,
    addonReporting: updated.addonReporting,
    addonGuestHistory: updated.addonGuestHistory,
    addonEventTicketing: updated.addonEventTicketing,
  };

  let synced = false;
  let syncError = "";

  try {
    const syncResult = syncAddonsToRestaurantDb(updated.slug, addonState, updated.dbPath);
    synced = true;

    const syncEvent = await createLicenseEvent({
      restaurantId: id,
      event: LicenseEventType.ADDON_SYNCED,
      details: `Synced settings to ${syncResult.dbPath}`,
      performedBy: session.email,
    });
    events.push(syncEvent);
  } catch (error) {
    syncError = error instanceof Error ? error.message : "Unknown sync error";
    const failedEvent = await createLicenseEvent({
      restaurantId: id,
      event: LicenseEventType.ADDON_SYNC_FAILED,
      details: syncError,
      performedBy: session.email,
    });
    events.push(failedEvent);
  }

  return NextResponse.json({
    restaurant: updated,
    synced,
    syncError: syncError || undefined,
    events,
  });
}
