import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const { searchParams } = new URL(req.url);
  const fromDateRaw = searchParams.get("fromDate") || new Date().toISOString().split("T")[0];
  const fromDate = isIsoDate(fromDateRaw) ? fromDateRaw : new Date().toISOString().split("T")[0];
  const daysRaw = parseInt(searchParams.get("days") || "7", 10);
  const days = Math.min(31, Math.max(1, Number.isFinite(daysRaw) ? daysRaw : 7));

  const end = new Date(`${fromDate}T00:00:00`);
  end.setDate(end.getDate() + days);
  const endDate = end.toISOString().split("T")[0];

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
