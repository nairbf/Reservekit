import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "pending";
  const date = searchParams.get("date");
  const where: Record<string, unknown> = {};
  if (status !== "all") { where.status = status.includes(",") ? { in: status.split(",") } : status; }
  if (date) where.date = date;
  const reservations = await prisma.reservation.findMany({ where, include: { table: true, guest: true }, orderBy: [{ date: "asc" }, { time: "asc" }] });
  return NextResponse.json(reservations);
}
