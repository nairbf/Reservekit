import { NextRequest, NextResponse } from "next/server";
import { LicenseEventType, RestaurantPlan } from "@/generated/prisma/client";
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

function parsePlan(value: unknown): RestaurantPlan | null {
  const v = String(value || "");
  if (v === "CORE" || v === "SERVICE_PRO" || v === "FULL_SUITE") return v;
  return null;
}

function getAutoEnabledAddons(fromPlan: RestaurantPlan, toPlan: RestaurantPlan): AddonKey[] {
  if (fromPlan === toPlan) return [];

  if (fromPlan === "CORE" && toPlan === "SERVICE_PRO") {
    return ["addonSms", "addonFloorPlan", "addonReporting"];
  }

  if (fromPlan === "CORE" && toPlan === "FULL_SUITE") {
    return [...ADDON_KEYS];
  }

  if (fromPlan === "SERVICE_PRO" && toPlan === "FULL_SUITE") {
    return ["addonGuestHistory", "addonEventTicketing"];
  }

  return [];
}

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

  const body = (await req.json()) as { plan?: string };
  const nextPlan = parsePlan(body.plan);
  if (!nextPlan) return badRequest("Invalid plan");

  const autoEnable = getAutoEnabledAddons(current.plan, nextPlan);
  const addonPatch: Partial<Record<AddonKey, boolean>> = {};
  for (const key of autoEnable) addonPatch[key] = true;

  const updated = await prisma.restaurant.update({
    where: { id },
    data: {
      plan: nextPlan,
      ...addonPatch,
    },
  });

  const events = [];
  events.push(
    await createLicenseEvent({
      restaurantId: id,
      event: LicenseEventType.PLAN_CHANGED,
      details: `Plan changed from ${current.plan} to ${nextPlan}`,
      performedBy: session.email,
    }),
  );

  const addonEvents = await createLicenseEvents(
    autoEnable
      .filter((key) => !current[key])
      .map((key) => ({
        restaurantId: id,
        event: LicenseEventType.ADDON_ENABLED,
        details: `${addonLabel(key)} enabled via ${nextPlan}`,
        performedBy: session.email,
      })),
  );
  events.push(...addonEvents);

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
    events.push(
      await createLicenseEvent({
        restaurantId: id,
        event: LicenseEventType.ADDON_SYNCED,
        details: `Plan sync updated ${syncResult.dbPath}`,
        performedBy: session.email,
      }),
    );
  } catch (error) {
    syncError = error instanceof Error ? error.message : "Unknown sync error";
    events.push(
      await createLicenseEvent({
        restaurantId: id,
        event: LicenseEventType.ADDON_SYNC_FAILED,
        details: syncError,
        performedBy: session.email,
      }),
    );
  }

  return NextResponse.json({
    restaurant: updated,
    synced,
    syncError: syncError || undefined,
    autoEnabled: autoEnable,
    events,
  });
}
