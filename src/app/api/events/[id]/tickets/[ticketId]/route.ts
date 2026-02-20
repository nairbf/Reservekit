import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { refundPayment } from "@/lib/payments";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; ticketId: string }> },
) {
  try {
    await requirePermission("manage_events");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, ticketId } = await params;
  const eventId = Number(id);
  const parsedTicketId = Number(ticketId);
  if (!Number.isFinite(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }
  if (!Number.isFinite(parsedTicketId) || parsedTicketId <= 0) {
    return NextResponse.json({ error: "Invalid ticket id" }, { status: 400 });
  }

  const ticket = await prisma.eventTicket.findFirst({
    where: {
      id: Math.trunc(parsedTicketId),
      eventId: Math.trunc(eventId),
    },
  });

  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  if (ticket.status === "cancelled" || ticket.status === "refunded") {
    return NextResponse.json({ error: "Ticket is already cancelled" }, { status: 409 });
  }

  let refunded = false;
  let refundError = "";
  if (ticket.stripePaymentIntentId && ticket.totalPaid > 0) {
    try {
      await refundPayment(ticket.stripePaymentIntentId, ticket.totalPaid);
      refunded = true;
    } catch (error) {
      refundError = error instanceof Error ? error.message : "Refund failed";
    }
  }
  if (refundError) {
    return NextResponse.json({ error: refundError }, { status: 409 });
  }

  const quantity = Math.max(1, ticket.quantity);
  const result = await prisma.$transaction(async (tx) => {
    const event = await tx.event.findUnique({ where: { id: Math.trunc(eventId) } });
    if (!event) throw new Error("Event not found");

    const updatedTicket = await tx.eventTicket.update({
      where: { id: ticket.id },
      data: {
        status: refunded ? "refunded" : "cancelled",
        checkedInAt: null,
        updatedAt: new Date(),
      },
    });

    const updatedEvent = await tx.event.update({
      where: { id: event.id },
      data: { soldTickets: Math.max(0, event.soldTickets - quantity) },
      select: { soldTickets: true },
    });

    return { updatedTicket, soldTickets: updatedEvent.soldTickets };
  });

  return NextResponse.json({
    success: true,
    refunded,
    ticket: result.updatedTicket,
    soldTickets: result.soldTickets,
  });
}
