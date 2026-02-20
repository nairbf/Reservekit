import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requirePermission("view_guests"); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

  const { id } = await params;
  const guestId = parseInt(id, 10);
  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    include: {
      reservations: {
        orderBy: { date: "desc" },
        take: 20,
        include: { table: true },
      },
    },
  });

  if (!guest) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const eventTickets = await prisma.eventTicket.findMany({
    where: {
      OR: [
        { guestId },
        ...(guest.email ? [{ guestEmail: guest.email }] : []),
      ],
    },
    include: {
      event: {
        select: {
          id: true,
          name: true,
          date: true,
          startTime: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const preOrders = await prisma.preOrder.findMany({
    where: {
      reservation: { guestId },
    },
    include: {
      reservation: {
        select: {
          id: true,
          date: true,
          time: true,
          code: true,
          status: true,
        },
      },
      items: {
        include: {
          menuItem: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return NextResponse.json({
    ...guest,
    eventTickets,
    preOrders,
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requirePermission("view_guests"); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

  const { id } = await params;
  const body = await req.json();

  const guest = await prisma.guest.update({
    where: { id: parseInt(id) },
    data: {
      vipStatus: body.vipStatus ?? undefined,
      dietaryNotes: body.dietaryNotes ?? undefined,
      allergyNotes: body.allergyNotes ?? undefined,
      generalNotes: body.generalNotes ?? undefined,
      tags: body.tags ?? undefined,
      name: body.name ?? undefined,
      email: body.email ?? undefined,
    },
  });

  return NextResponse.json(guest);
}
