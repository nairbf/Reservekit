import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getRestaurantTimezone, getTodayInTimezone, restaurantDateTimeToUTC } from "@/lib/timezone";

export async function GET() {
  try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const timezone = await getRestaurantTimezone();
  const today = getTodayInTimezone(timezone);
  const tables = await prisma.restaurantTable.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
  const ids = tables.map(t => t.id);

  const reservations = await prisma.reservation.findMany({
    where: { date: today, status: { in: ["approved", "confirmed", "arrived", "seated"] }, tableId: { in: ids } },
    select: { id: true, guestName: true, partySize: true, time: true, date: true, status: true, tableId: true, seatedAt: true, durationMin: true, code: true },
    orderBy: { time: "asc" },
  });

  const byTable = new Map<number, typeof reservations>();
  for (const r of reservations) {
    if (!r.tableId) continue;
    if (!byTable.has(r.tableId)) byTable.set(r.tableId, []);
    byTable.get(r.tableId)!.push(r);
  }

  const now = new Date();

  const data = tables.map(t => {
    const list = byTable.get(t.id) || [];

    const seated = list.filter(r => r.status === "seated");
    const arrived = list.filter(r => r.status === "arrived");
    const upcoming = list.filter(r => {
      if (!(r.status === "approved" || r.status === "confirmed")) return false;
      const diffMin = (restaurantDateTimeToUTC(r.date, r.time, timezone).getTime() - now.getTime()) / 60000;
      return diffMin >= 0 && diffMin <= 60;
    });

    let reservation = seated.sort((a, b) => (b.seatedAt?.getTime() || 0) - (a.seatedAt?.getTime() || 0))[0]
      || arrived[0]
      || upcoming[0]
      || null;

    let timeStatus: "empty" | "upcoming" | "arrived" | "seated" | "almost_done" = "empty";

    if (reservation) {
      if (reservation.status === "arrived") timeStatus = "arrived";
      else if (reservation.status === "seated") {
        const seatedAt = reservation.seatedAt ? new Date(reservation.seatedAt) : null;
        const thresholdMs = reservation.durationMin * 0.8 * 60 * 1000;
        if (seatedAt && now.getTime() > seatedAt.getTime() + thresholdMs) timeStatus = "almost_done";
        else timeStatus = "seated";
      } else timeStatus = "upcoming";
    }

    return { table: t, reservation, timeStatus };
  });

  return NextResponse.json(data);
}
