import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, requireAuth } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eventId = Number(id);
  if (!Number.isFinite(eventId) || eventId <= 0) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const session = await getSession();
  const event = await prisma.event.findUnique({
    where: { id: Math.trunc(eventId) },
    include: {
      tickets: {
        orderBy: { createdAt: "desc" },
        take: session ? 500 : 0,
      },
    },
  });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!event.isActive && !session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const checkedIn = event.tickets.filter(t => t.status === "checked_in").length;
  return NextResponse.json({
    ...event,
    remainingTickets: Math.max(0, event.maxTickets - event.soldTickets),
    revenue: event.tickets
      .filter(t => ["confirmed", "checked_in"].includes(t.status))
      .reduce((sum, t) => sum + t.totalPaid, 0),
    checkInRate: event.tickets.length ? Math.round((checkedIn / event.tickets.length) * 100) : 0,
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const eventId = Number(id);
  if (!Number.isFinite(eventId) || eventId <= 0) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json();
  const updated = await prisma.event.update({
    where: { id: Math.trunc(eventId) },
    data: {
      name: body?.name ? String(body.name) : undefined,
      description: body?.description !== undefined ? (body.description ? String(body.description) : null) : undefined,
      date: body?.date ? String(body.date) : undefined,
      startTime: body?.startTime ? String(body.startTime) : undefined,
      endTime: body?.endTime !== undefined ? (body.endTime ? String(body.endTime) : null) : undefined,
      ticketPrice: body?.ticketPrice !== undefined ? Math.max(0, Math.trunc(Number(body.ticketPrice || 0))) : undefined,
      maxTickets: body?.maxTickets !== undefined ? Math.max(1, Math.trunc(Number(body.maxTickets || 1))) : undefined,
      isActive: body?.isActive !== undefined ? Boolean(body.isActive) : undefined,
      imageUrl: body?.imageUrl !== undefined ? (body.imageUrl ? String(body.imageUrl) : null) : undefined,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const eventId = Number(id);
  if (!Number.isFinite(eventId) || eventId <= 0) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const updated = await prisma.event.update({
    where: { id: Math.trunc(eventId) },
    data: { isActive: false, updatedAt: new Date() },
  });
  return NextResponse.json(updated);
}
