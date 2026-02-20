import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("manage_events");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
  if (ticket.status !== "confirmed") {
    return NextResponse.json({ error: "Only confirmed tickets can be checked in" }, { status: 409 });
  }

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
