import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const value = String(slug || "").trim().toLowerCase();
  if (!value) return NextResponse.json({ error: "Invalid slug" }, { status: 400 });

  const event = await prisma.event.findUnique({
    where: { slug: value },
  });

  if (!event || !event.isActive) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const remainingTickets = Math.max(0, event.maxTickets - event.soldTickets);
  return NextResponse.json({
    id: event.id,
    name: event.name,
    description: event.description,
    date: event.date,
    startTime: event.startTime,
    endTime: event.endTime,
    ticketPrice: event.ticketPrice,
    maxTickets: event.maxTickets,
    soldTickets: event.soldTickets,
    slug: event.slug,
    remainingTickets,
    soldOut: remainingTickets <= 0,
  });
}
