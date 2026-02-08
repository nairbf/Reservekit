import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { createPaymentIntent } from "@/lib/payments";
import { generateEventICS } from "@/lib/calendar";

function normalizePhone(value: string): string {
  return String(value || "").replace(/[^\d+]/g, "").trim();
}

function formatTime12(value: string): string {
  const [h, m] = String(value || "00:00").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return value;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function generateEventTicketCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "RS-EVT-";
  for (let i = 0; i < 4; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function getStripeClient() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("Stripe not configured");
  const Stripe = (await import("stripe")).default;
  return new Stripe(secret);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eventId = Number(id);
  if (!Number.isFinite(eventId) || eventId <= 0) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json();
  const phase = String(body?.phase || "prepare");
  const guestName = String(body?.guestName || "").trim();
  const guestEmail = String(body?.guestEmail || "").trim();
  const guestPhoneRaw = String(body?.guestPhone || "");
  const guestPhone = normalizePhone(guestPhoneRaw);
  const quantity = Math.max(1, Math.trunc(Number(body?.quantity || 1)));

  const event = await prisma.event.findUnique({ where: { id: Math.trunc(eventId) } });
  if (!event || !event.isActive) return NextResponse.json({ error: "Event not available" }, { status: 404 });

  const remaining = Math.max(0, event.maxTickets - event.soldTickets);
  if (remaining < quantity) return NextResponse.json({ error: "Not enough tickets remaining" }, { status: 409 });

  if (!guestName || !guestEmail) {
    return NextResponse.json({ error: "Guest name and email are required" }, { status: 400 });
  }

  if (phase === "prepare") {
    const amount = event.ticketPrice * quantity;
    const intent = await createPaymentIntent({
      amount,
      currency: "usd",
      type: "deposit",
      metadata: {
        eventId: String(event.id),
        eventSlug: event.slug,
        quantity: String(quantity),
        guestEmail,
      },
    });
    return NextResponse.json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      amount,
      quantity,
      currency: "usd",
    });
  }

  if (phase !== "finalize") {
    return NextResponse.json({ error: "Unknown phase" }, { status: 400 });
  }

  const paymentIntentId = String(body?.paymentIntentId || "").trim();
  if (!paymentIntentId) return NextResponse.json({ error: "paymentIntentId is required" }, { status: 400 });

  const existing = await prisma.eventTicket.findFirst({ where: { stripePaymentIntentId: paymentIntentId } });
  if (existing) return NextResponse.json(existing);

  const stripe = await getStripeClient();
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (!intent || intent.status !== "succeeded") {
    return NextResponse.json({ error: "Payment is not completed" }, { status: 409 });
  }

  const totalPaid = event.ticketPrice * quantity;
  if (intent.amount_received < totalPaid) {
    return NextResponse.json({ error: "Insufficient paid amount" }, { status: 409 });
  }

  const guest = guestPhone
    ? await prisma.guest.findFirst({
        where: {
          OR: [{ phone: guestPhone }, { phone: guestPhoneRaw }],
        },
      })
    : null;

  let code = generateEventTicketCode();
  while (await prisma.eventTicket.findUnique({ where: { code } })) code = generateEventTicketCode();

  const ticket = await prisma.$transaction(async tx => {
    const latest = await tx.event.findUnique({ where: { id: event.id } });
    if (!latest || !latest.isActive) throw new Error("Event unavailable");
    if (latest.soldTickets + quantity > latest.maxTickets) throw new Error("Sold out");

    const created = await tx.eventTicket.create({
      data: {
        eventId: latest.id,
        guestName,
        guestEmail,
        guestPhone: guestPhone || null,
        quantity,
        totalPaid,
        stripePaymentIntentId: paymentIntentId,
        status: "confirmed",
        code,
        guestId: guest?.id || null,
      },
    });

    await tx.event.update({
      where: { id: latest.id },
      data: { soldTickets: { increment: quantity } },
    });

    return created;
  });

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const subject = `Your tickets for ${event.name}`;
  const eventIcs = await generateEventICS({
    id: event.id,
    name: event.name,
    date: event.date,
    startTime: event.startTime,
    endTime: event.endTime,
    ticketCode: ticket.code,
  });
  const message = [
    `Hi ${guestName},`,
    "",
    `Thanks for purchasing tickets for ${event.name}.`,
    `Date: ${event.date}`,
    `Time: ${formatTime12(event.startTime)}${event.endTime ? ` - ${formatTime12(event.endTime)}` : ""}`,
    `Quantity: ${quantity}`,
    `Total paid: $${(totalPaid / 100).toFixed(2)}`,
    `Ticket code: ${ticket.code}`,
    "",
    `View event: ${appUrl}/events/${event.slug}`,
  ].join("\n");

  await sendEmail({
    to: guestEmail,
    subject,
    body: message,
    messageType: "event_ticket_confirmation",
    attachments: [{ filename: `${event.slug}.ics`, content: eventIcs, contentType: "text/calendar" }],
  });

  return NextResponse.json({
    ticket,
    calendarIcs: eventIcs,
    event: {
      id: event.id,
      slug: event.slug,
      name: event.name,
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
    },
  });
}
