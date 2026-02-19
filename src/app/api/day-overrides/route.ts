import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export async function GET() {
  try { await requirePermission("manage_schedule"); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  return NextResponse.json(await prisma.dayOverride.findMany({ orderBy: { date: "asc" } }));
}

export async function POST(req: NextRequest) {
  try { await requirePermission("manage_schedule"); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  const d = await req.json();
  const override = await prisma.dayOverride.upsert({
    where: { date: d.date },
    update: { isClosed: d.isClosed || false, openTime: d.openTime || null, closeTime: d.closeTime || null, maxCovers: d.maxCovers || null, note: d.note || null },
    create: { date: d.date, isClosed: d.isClosed || false, openTime: d.openTime || null, closeTime: d.closeTime || null, maxCovers: d.maxCovers || null, note: d.note || null },
  });
  return NextResponse.json(override);
}
