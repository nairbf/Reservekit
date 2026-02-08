import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const { searchParams } = new URL(req.url);
  const endDate = searchParams.get("endDate") || new Date().toISOString().split("T")[0];
  const startDate = searchParams.get("startDate") || (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split("T")[0]; })();

  const reservations = await prisma.reservation.findMany({ where: { date: { gte: startDate, lte: endDate } }, select: { date: true, partySize: true, status: true, source: true } });

  const coversPerDay: Record<string, number> = {};
  let totalCovers = 0, totalReservations = 0, noShows = 0;
  const bySource: Record<string, number> = { widget: 0, phone: 0, walkin: 0 };
  const byStatus: Record<string, number> = {};

  for (const r of reservations) {
    if (["seated", "completed"].includes(r.status)) { coversPerDay[r.date] = (coversPerDay[r.date] || 0) + r.partySize; totalCovers += r.partySize; }
    if (!["cancelled", "declined", "expired"].includes(r.status)) totalReservations++;
    if (r.status === "no_show") noShows++;
    bySource[r.source] = (bySource[r.source] || 0) + 1;
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  }

  return NextResponse.json({
    period: { startDate, endDate }, totalCovers, totalReservations, noShows,
    noShowRate: totalReservations > 0 ? Math.round((noShows / totalReservations) * 100) : 0,
    avgCoversPerDay: Object.keys(coversPerDay).length > 0 ? Math.round(totalCovers / Object.keys(coversPerDay).length) : 0,
    coversPerDay, bySource, byStatus,
  });
}
