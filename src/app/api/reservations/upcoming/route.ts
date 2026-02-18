import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { addDaysToDateString, getRestaurantTimezone, getTodayInTimezone } from "@/lib/timezone";

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const { searchParams } = new URL(req.url);
  const timezone = await getRestaurantTimezone();
  const today = getTodayInTimezone(timezone);
  const fromDateRaw = searchParams.get("fromDate") || today;
  const fromDate = isIsoDate(fromDateRaw) ? fromDateRaw : today;
  const daysRaw = parseInt(searchParams.get("days") || "7", 10);
  const days = Math.min(31, Math.max(1, Number.isFinite(daysRaw) ? daysRaw : 7));
  const endDate = addDaysToDateString(fromDate, days);

  const reservations = await prisma.reservation.findMany({
    where: {
      date: { gt: fromDate, lte: endDate },
      status: { notIn: ["cancelled", "declined", "expired"] },
    },
    include: { table: true, guest: true },
    orderBy: [{ date: "asc" }, { time: "asc" }],
    take: 200,
  });

  return NextResponse.json({
    fromDate,
    endDate,
    days,
    count: reservations.length,
    reservations,
  });
}
