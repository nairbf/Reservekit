import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { reorderActiveWaitlistPositions } from "@/lib/waitlist";

function normalizePhone(value: string): string {
  return String(value || "").replace(/[^\d+]/g, "").trim();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  const phone = normalizePhone(searchParams.get("phone") || "");
  if (!Number.isFinite(id) || id <= 0 || !phone) {
    return NextResponse.json({ error: "id and phone are required" }, { status: 400 });
  }

  const entry = await prisma.waitlistEntry.findUnique({ where: { id: Math.trunc(id) } });
  if (!entry || normalizePhone(entry.guestPhone) !== phone) {
    return NextResponse.json({ error: "Waitlist entry not found" }, { status: 404 });
  }

  return NextResponse.json(entry);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const id = Number(body?.id);
  const phone = normalizePhone(body?.phone || "");
  const action = String(body?.action || "").toLowerCase();
  if (!Number.isFinite(id) || id <= 0 || !phone) {
    return NextResponse.json({ error: "id and phone are required" }, { status: 400 });
  }
  if (action !== "cancel") {
    return NextResponse.json({ error: "Only cancel is supported" }, { status: 400 });
  }

  const entry = await prisma.waitlistEntry.findUnique({ where: { id: Math.trunc(id) } });
  if (!entry || normalizePhone(entry.guestPhone) !== phone) {
    return NextResponse.json({ error: "Waitlist entry not found" }, { status: 404 });
  }

  const updated = await prisma.waitlistEntry.update({
    where: { id: entry.id },
    data: { status: "cancelled", updatedAt: new Date() },
  });
  await reorderActiveWaitlistPositions();
  return NextResponse.json(updated);
}
