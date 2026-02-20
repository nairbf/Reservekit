import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTodaysWaitlist, estimateWaitMinutes } from "@/lib/waitlist";
import { calculateWaitlistEstimate } from "@/lib/smart/waitlist-estimate";
import { getRestaurantTimezone } from "@/lib/timezone";

function formatTimeInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const partySize = Math.max(1, parseInt(searchParams.get("partySize") || "2", 10) || 2);
  const requestedPosition = parseInt(searchParams.get("position") || "", 10);
  const rows = await getTodaysWaitlist();
  const activeRows = rows.filter((row) => ["waiting", "notified"].includes(row.status));
  const position = Number.isFinite(requestedPosition) && requestedPosition > 0
    ? requestedPosition
    : activeRows.length + 1;

  const featureRow = await prisma.setting.findUnique({ where: { key: "smartWaitlistEstimate" } });
  const smartEnabled = featureRow?.value !== "false";

  if (smartEnabled) {
    const smartEstimate = await calculateWaitlistEstimate(partySize, position);
    return NextResponse.json({
      position,
      partiesAhead: Math.max(0, position - 1),
      estimatedMinutes: smartEstimate.estimatedMinutes,
      estimatedTime: smartEstimate.estimatedTime,
      basedOn: smartEstimate.basedOn,
      smart: true,
    });
  }

  const estimate = await estimateWaitMinutes(
    partySize,
    activeRows.map((row) => ({ partySize: row.partySize, status: row.status })),
  );
  const timezone = await getRestaurantTimezone();
  const estimatedTime = formatTimeInTimezone(
    new Date(Date.now() + estimate.estimatedMinutes * 60_000),
    timezone,
  );
  return NextResponse.json({
    ...estimate,
    position,
    estimatedTime,
    basedOn: estimate.partiesAhead > 0
      ? `${estimate.partiesAhead} similar part${estimate.partiesAhead === 1 ? "y" : "ies"} ahead`
      : "No active parties ahead",
    smart: false,
  });
}
