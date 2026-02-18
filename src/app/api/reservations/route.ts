import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getRestaurantTimezone, getTodayInTimezone } from "@/lib/timezone";

export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "pending";
  const date = searchParams.get("date");
  const upcoming = searchParams.get("upcoming") === "true";
  const where: Record<string, unknown> = {};
  if (status !== "all") { where.status = status.includes(",") ? { in: status.split(",") } : status; }
  const timezone = await getRestaurantTimezone();
  const today = getTodayInTimezone(timezone);
  if (date) {
    where.date = date === "today" ? today : date;
  } else if (upcoming) {
    where.date = { gte: today };
  }

  try {
    const reservations = await prisma.reservation.findMany({
      where,
      include: {
        table: true,
        guest: true,
        payment: true,
        preOrder: {
          include: {
            items: {
              include: { menuItem: { include: { category: true } } },
              orderBy: [{ guestLabel: "asc" }, { id: "asc" }],
            },
          },
        },
      },
      orderBy: [{ date: "asc" }, { time: "asc" }],
    });
    return NextResponse.json(reservations);
  } catch (err) {
    const e = err as { code?: string; message?: string };
    // Graceful fallback when DB schema is behind code (e.g. missing PreOrder table locally).
    if (e?.code === "P2021" && String(e.message || "").includes("PreOrder")) {
      try {
        const reservations = await prisma.reservation.findMany({
          where,
          include: { table: true, guest: true, payment: true },
          orderBy: [{ date: "asc" }, { time: "asc" }],
        });
        return NextResponse.json(reservations.map(r => ({ ...r, preOrder: null })));
      } catch (fallbackErr) {
        console.error("[RESERVATIONS GET FALLBACK ERROR]", fallbackErr);
      }
    }
    console.error("[RESERVATIONS GET ERROR]", err);
    return NextResponse.json({ error: "Failed to load reservations." }, { status: 500 });
  }
}
