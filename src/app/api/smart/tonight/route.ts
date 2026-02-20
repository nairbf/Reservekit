import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getRestaurantTimezone, getTodayInTimezone } from "@/lib/timezone";
import { calculateTurnTimes } from "@/lib/smart/turn-time";
import { calculateNoShowRisk, type NoShowRisk } from "@/lib/smart/no-show-risk";
import { getGuestTags, type GuestTag } from "@/lib/smart/guest-intel";
import { checkPacingAlerts, type PacingAlert } from "@/lib/smart/pacing";
import type { TurnTimeStats } from "@/lib/smart/turn-time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReservationSmartData = {
  noShowRisk?: NoShowRisk;
  guestTags?: GuestTag[];
};

const FEATURE_KEYS = [
  "smartTurnTime",
  "smartNoShowRisk",
  "smartGuestIntel",
  "smartWaitlistEstimate",
  "smartDailyPrep",
  "smartPacingAlerts",
] as const;

function isFeatureEnabled(map: Map<string, string>, key: (typeof FEATURE_KEYS)[number]): boolean {
  return map.get(key) !== "false";
}

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const timezone = await getRestaurantTimezone();
  const today = getTodayInTimezone(timezone);
  const requestedDate = String(req.nextUrl.searchParams.get("date") || "").trim();
  const date = requestedDate || today;

  const [featureRows, reservations] = await Promise.all([
    prisma.setting.findMany({ where: { key: { in: [...FEATURE_KEYS] } } }),
    prisma.reservation.findMany({
      where: { date, status: { in: ["confirmed", "pending", "approved", "arrived", "seated"] } },
      select: {
        id: true,
        guestId: true,
        partySize: true,
        tableId: true,
        status: true,
        seatedAt: true,
      },
    }),
  ]);

  const featureMap = new Map(featureRows.map((row) => [row.key, row.value]));
  const features = {
    smartTurnTime: isFeatureEnabled(featureMap, "smartTurnTime"),
    smartNoShowRisk: isFeatureEnabled(featureMap, "smartNoShowRisk"),
    smartGuestIntel: isFeatureEnabled(featureMap, "smartGuestIntel"),
    smartWaitlistEstimate: isFeatureEnabled(featureMap, "smartWaitlistEstimate"),
    smartDailyPrep: isFeatureEnabled(featureMap, "smartDailyPrep"),
    smartPacingAlerts: isFeatureEnabled(featureMap, "smartPacingAlerts"),
  };

  let turnTimes: TurnTimeStats | null = null;
  if (features.smartTurnTime) {
    turnTimes = await calculateTurnTimes();
  }

  let pacingAlerts: PacingAlert[] | null = null;
  if (features.smartPacingAlerts && date === today) {
    pacingAlerts = await checkPacingAlerts();
  }

  const entries = await Promise.all(
    reservations.map(async (reservation) => {
      const data: ReservationSmartData = {};

      if (features.smartNoShowRisk && reservation.status !== "seated") {
        data.noShowRisk = await calculateNoShowRisk(reservation.id);
      }

      if (features.smartGuestIntel && reservation.guestId) {
        data.guestTags = await getGuestTags(reservation.guestId);
      }

      return [reservation.id, data] as const;
    }),
  );

  const result: Record<number, ReservationSmartData> = {};
  for (const [reservationId, data] of entries) {
    result[reservationId] = data;
  }

  return NextResponse.json({
    features,
    reservations: result,
    turnTimes,
    pacingAlerts,
    date,
  });
}
