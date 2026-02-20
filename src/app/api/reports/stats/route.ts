import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { addDaysToDateString, getRestaurantTimezone, getTodayInTimezone } from "@/lib/timezone";

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function startOfDayUtc(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function endOfDayUtc(isoDate: string): Date {
  return new Date(`${isoDate}T23:59:59.999Z`);
}

function daysBetweenInclusive(startDate: string, endDate: string): number {
  const start = startOfDayUtc(startDate).getTime();
  const end = startOfDayUtc(endDate).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 1;
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function parseHourFromTime(value: string): number | null {
  const match = (value || "").trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null;
  return hour;
}

export async function GET(req: NextRequest) {
  try { await requirePermission("view_reports"); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  const { searchParams } = new URL(req.url);
  const timezone = await getRestaurantTimezone();
  const today = getTodayInTimezone(timezone);
  const endDateRaw = searchParams.get("endDate") || today;
  const endDate = isIsoDate(endDateRaw) ? endDateRaw : today;
  const startDateRaw = searchParams.get("startDate") || addDaysToDateString(endDate, -30);
  const startDate = isIsoDate(startDateRaw) ? startDateRaw : addDaysToDateString(endDate, -30);
  const createdAtRange = { gte: startOfDayUtc(startDate), lte: endOfDayUtc(endDate) };

  const reservations = await prisma.reservation.findMany({
    where: { date: { gte: startDate, lte: endDate } },
    select: {
      date: true,
      time: true,
      partySize: true,
      status: true,
      source: true,
      tableId: true,
      arrivedAt: true,
      seatedAt: true,
      completedAt: true,
      updatedAt: true,
    },
  });

  const [activeTableCount, guestCount, returningGuestCount, waitlistEntries, eventRevenueAgg, preOrderRevenueAgg, reservationRevenueAgg] = await Promise.all([
    prisma.restaurantTable.count({ where: { isActive: true } }),
    prisma.guest.count(),
    prisma.guest.count({ where: { totalVisits: { gt: 1 } } }),
    prisma.waitlistEntry.findMany({
      where: { createdAt: createdAtRange },
      select: { estimatedWait: true, status: true },
    }),
    prisma.eventTicket.aggregate({
      where: {
        status: { in: ["confirmed", "checked_in"] },
        event: { date: { gte: startDate, lte: endDate } },
      },
      _sum: { totalPaid: true },
    }),
    prisma.preOrder.aggregate({
      where: {
        status: { not: "cancelled" },
        reservation: { date: { gte: startDate, lte: endDate } },
      },
      _sum: { subtotal: true },
    }),
    prisma.reservationPayment.aggregate({
      where: {
        status: "captured",
        reservation: { date: { gte: startDate, lte: endDate } },
      },
      _sum: { amount: true },
    }),
  ]);

  const coversPerDay: Record<string, number> = {};
  const peakHoursMap: Record<number, number> = {};
  const waitDurations: number[] = [];
  const tableDurations: number[] = [];
  const partySizes: number[] = [];
  let totalCovers = 0, totalReservations = 0, noShows = 0, seatedCount = 0;
  const bySource: Record<string, number> = { widget: 0, phone: 0, walkin: 0 };
  const byStatus: Record<string, number> = {};

  for (const r of reservations) {
    const isCancelledLike = ["cancelled", "declined", "expired"].includes(r.status);

    if (["seated", "completed"].includes(r.status)) { coversPerDay[r.date] = (coversPerDay[r.date] || 0) + r.partySize; totalCovers += r.partySize; }
    if (!isCancelledLike) {
      totalReservations++;
      partySizes.push(r.partySize);
    }
    if (["seated", "completed"].includes(r.status)) seatedCount++;
    if (r.status === "no_show") noShows++;
    bySource[r.source] = (bySource[r.source] || 0) + 1;
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;

    const hour = parseHourFromTime(r.time);
    if (hour !== null) peakHoursMap[hour] = (peakHoursMap[hour] || 0) + 1;

    if (r.arrivedAt && r.seatedAt) {
      const minutes = Math.round((new Date(r.seatedAt).getTime() - new Date(r.arrivedAt).getTime()) / 60000);
      if (minutes >= 0 && minutes <= 240) waitDurations.push(minutes);
    }

    if (r.status === "completed" && r.seatedAt) {
      const endAt = r.completedAt ?? r.updatedAt;
      const minutes = Math.round((new Date(endAt).getTime() - new Date(r.seatedAt).getTime()) / 60000);
      if (minutes >= 5 && minutes <= 600) tableDurations.push(minutes);
    }
  }

  const waitlistTotal = waitlistEntries.length;
  const waitlistSeated = waitlistEntries.filter(entry => entry.status === "seated").length;
  const waitlistAvg = avg(waitlistEntries.map(entry => entry.estimatedWait ?? 0).filter(value => value > 0));
  const daysInRange = daysBetweenInclusive(startDate, endDate);
  const peakHours = Array.from({ length: 24 }, (_, hour) => ({ hour, count: peakHoursMap[hour] || 0 }));

  return NextResponse.json({
    period: { startDate, endDate },
    totalCovers,
    totalReservations,
    noShows,
    noShowRate: totalReservations > 0 ? Math.round((noShows / totalReservations) * 100) : 0,
    avgCoversPerDay: Object.keys(coversPerDay).length > 0 ? Math.round(totalCovers / Object.keys(coversPerDay).length) : 0,
    avgWaitTime: avg(waitDurations),
    avgTableTime: avg(tableDurations),
    avgPartySize: avg(partySizes),
    peakHours,
    coversPerDay,
    bySource,
    byStatus,
    guestReturnRate: guestCount > 0 ? Math.round((returningGuestCount / guestCount) * 100) : 0,
    waitlist: {
      totalEntries: waitlistTotal,
      avgEstimatedWait: waitlistAvg,
      conversionRate: waitlistTotal > 0 ? Math.round((waitlistSeated / waitlistTotal) * 100) : 0,
      seatedCount: waitlistSeated,
    },
    eventRevenue: eventRevenueAgg._sum.totalPaid || 0,
    preOrderRevenue: preOrderRevenueAgg._sum.subtotal || 0,
    reservationRevenue: reservationRevenueAgg._sum.amount || 0,
    tableTurnover: activeTableCount > 0 ? Number((seatedCount / activeTableCount / daysInRange).toFixed(2)) : 0,
  });
}
