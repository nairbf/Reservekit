import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const eventId = Number(id);
  if (!Number.isFinite(eventId) || eventId <= 0) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json();
  const code = String(body?.code || "").trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "Ticket code is required" }, { status: 400 });

  const ticket = await prisma.eventTicket.findFirst({
    where: { eventId: Math.trunc(eventId), code },
  });
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const updated = await prisma.eventTicket.update({
    where: { id: ticket.id },
    data: {
      status: "checked_in",
      checkedInAt: new Date(),
      updatedAt: new Date(),
    },
  });
  return NextResponse.json(updated);
}
