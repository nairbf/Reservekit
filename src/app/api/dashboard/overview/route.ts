import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getRestaurantTimezone, getTodayInTimezone, restaurantDateTimeToUTC } from "@/lib/timezone";
import { calculateTurnTimes } from "@/lib/smart/turn-time";

interface AlertItem {
  key: string;
  label: string;
  count: number;
  level: "urgent" | "info";
  href: string;
}

function parseReservationTimeToMinutes(value: string): number | null {
  const trimmed = String(value || "").trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function getCurrentMinutesInTimezone(timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  const hour = Number(byType.get("hour") || "0");
  const minute = Number(byType.get("minute") || "0");
  return hour * 60 + minute;
}

export async function GET() {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const timezone = await getRestaurantTimezone();
  const today = getTodayInTimezone(timezone);
  const now = new Date();
  const nowMinutes = getCurrentMinutesInTimezone(timezone);

  const [todayReservations, pendingCount, waitlistCount, posStatusRows] = await Promise.all([
    prisma.reservation.findMany({
      where: { date: today },
      select: {
        id: true,
        guestName: true,
        partySize: true,
        status: true,
        time: true,
        seatedAt: true,
        date: true,
        tableId: true,
      },
      orderBy: [{ time: "asc" }, { id: "asc" }],
    }),
    prisma.reservation.count({ where: { status: { in: ["pending", "counter_offered"] } } }),
    prisma.waitlistEntry.count({ where: { status: { in: ["waiting", "notified"] } } }),
    prisma.setting.findMany({ where: { key: { startsWith: "pos_status_" } }, select: { key: true } }),
  ]);

  const seatedCount = todayReservations.filter((reservation) => reservation.status === "seated").length;
  const arrivedCount = todayReservations.filter((reservation) => reservation.status === "arrived").length;
  const upcomingCandidates = todayReservations.filter((reservation) => ["approved", "confirmed"].includes(reservation.status));
  const upcomingReservations = upcomingCandidates.filter((reservation) => {
    const reservationMinutes = parseReservationTimeToMinutes(reservation.time);
    if (reservationMinutes === null) return true;
    return reservationMinutes >= nowMinutes;
  });
  const upcomingCount = upcomingReservations.length;

  const activeToday = todayReservations.filter((reservation) => !["cancelled", "declined", "expired"].includes(reservation.status));
  const todayCovers = activeToday.reduce((sum, reservation) => sum + Math.max(0, reservation.partySize || 0), 0);
  const todayReservationsCount = activeToday.length;

  let readyPreOrders = 0;
  try {
    readyPreOrders = await prisma.preOrder.count({ where: { status: "ready" } });
  } catch (error) {
    const prismaError = error as { code?: string; message?: string };
    if (!(prismaError.code === "P2021" && String(prismaError.message || "").includes("PreOrder"))) {
      throw error;
    }
  }

  const turnTimes = await calculateTurnTimes();
  const overdueTables = todayReservations.filter((reservation) => {
    if (reservation.status !== "seated" || !reservation.seatedAt) return false;
    const estimatedMinutes =
      (reservation.tableId ? turnTimes.byTable[reservation.tableId] : undefined)
      || turnTimes.byPartySize[reservation.partySize]
      || turnTimes.overall
      || 60;
    const estimatedAvailableAt = reservation.seatedAt.getTime() + estimatedMinutes * 60_000;
    return now.getTime() > estimatedAvailableAt;
  }).length;

  const alerts: AlertItem[] = [];
  if (pendingCount > 0) {
    alerts.push({
      key: "pending",
      label: `${pendingCount} pending reservation${pendingCount === 1 ? "" : "s"} need approval`,
      count: pendingCount,
      level: "urgent",
      href: "/dashboard?view=incoming",
    });
  }
  if (waitlistCount > 0) {
    alerts.push({
      key: "waitlist",
      label: `${waitlistCount} waitlist guest${waitlistCount === 1 ? "" : "s"} waiting`,
      count: waitlistCount,
      level: "urgent",
      href: "/dashboard/waitlist",
    });
  }
  if (overdueTables > 0) {
    alerts.push({
      key: "overdue",
      label: `${overdueTables} table${overdueTables === 1 ? "" : "s"} occupied past estimated time`,
      count: overdueTables,
      level: "info",
      href: "/dashboard/floorplan",
    });
  }
  if (readyPreOrders > 0) {
    alerts.push({
      key: "preorders_ready",
      label: `${readyPreOrders} pre-order${readyPreOrders === 1 ? "" : "s"} ready in kitchen`,
      count: readyPreOrders,
      level: "info",
      href: "/dashboard/kitchen",
    });
  }

  const nextUpcoming = upcomingReservations
    .map((reservation) => {
      const reservationUTC = restaurantDateTimeToUTC(reservation.date, String(reservation.time || "").slice(0, 5), timezone);
      return {
        ...reservation,
        startsAtMs: Number.isNaN(reservationUTC.getTime()) ? Number.MAX_SAFE_INTEGER : reservationUTC.getTime(),
      };
    })
    .sort((a, b) => a.startsAtMs - b.startsAtMs)
    .slice(0, 5)
    .map(({ startsAtMs, ...reservation }) => reservation);

  return NextResponse.json({
    today,
    rightNow: {
      seatedCount,
      arrivedCount,
      upcomingCount,
      pendingCount,
    },
    snapshot: {
      todayCovers,
      todayReservations: todayReservationsCount,
      waitlistCount,
      openPosChecks: posStatusRows.length,
    },
    alerts,
    nextUpcoming,
  });
}
