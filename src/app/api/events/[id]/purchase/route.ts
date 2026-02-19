import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getAppUrlFromRequest } from "@/lib/app-url";
import { createPaymentIntent } from "@/lib/payments";
import { generateEventICS } from "@/lib/calendar";
import { sendNotification } from "@/lib/send-notification";
import { checkReservationRate, getClientIp, tooManyRequests } from "@/lib/rate-limit";
import { getStripeInstance, getStripeSecretKey } from "@/lib/stripe";

function normalizePhone(value: string): string {
  return String(value || "").replace(/\D/g, "").trim();
}

function formatTime12(value: string): string {
  const [h, m] = String(value || "00:00").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return value;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function generateEventTicketCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "RS-EVT-";
  for (let i = 0; i < 4; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function uniqueTicketCode(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) {
  let code = generateEventTicketCode();
  while (await tx.eventTicket.findUnique({ where: { code } })) {
    code = generateEventTicketCode();
  }
  return code;
}

async function stripePaymentStatus(paymentIntentId: string) {
  const stripe = await getStripeInstance();
  if (!stripe) throw new Error("Stripe not configured");
  return stripe.paymentIntents.retrieve(paymentIntentId);
}

async function getRestaurantName(): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key: "restaurantName" } });
  return row?.value || "ReserveSit";
}

async function ensureGuest(guestName: string, guestEmail: string, rawPhone: string, normalizedPhone: string): Promise<number | null> {
  if (!normalizedPhone && !rawPhone) return null;

  const guest = await prisma.guest.findFirst({
    where: {
      OR: [
        normalizedPhone ? { phone: normalizedPhone } : undefined,
        rawPhone ? { phone: rawPhone } : undefined,
      ].filter(Boolean) as Array<{ phone: string }>,
    },
  });

  if (guest) {
    await prisma.guest.update({
      where: { id: guest.id },
      data: {
        name: guestName || guest.name,
        email: guestEmail || guest.email,
      },
    });
    return guest.id;
  }

  const phoneForCreate = normalizedPhone || rawPhone;
  if (!phoneForCreate) return null;

  const created = await prisma.guest.create({
    data: {
      phone: phoneForCreate,
      name: guestName || "Guest",
      email: guestEmail || null,
    },
  });
  return created.id;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = getClientIp(req);
  const limit = checkReservationRate(ip);
  if (!limit.allowed) return tooManyRequests(limit.resetAt);

  const { id } = await params;
  const eventId = Number(id);
  if (!Number.isFinite(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json();
  const guestName = String(body?.guestName || "").trim();
  const guestEmail = String(body?.guestEmail || "").trim();
  const guestPhoneRaw = String(body?.guestPhone || "").trim();
  const guestPhone = normalizePhone(guestPhoneRaw);
  const quantity = Math.max(1, Math.min(10, Math.trunc(Number(body?.quantity || 1))));
  const manual = Boolean(body?.manual);
  const manualPaid = Boolean(body?.paid);
  const paymentIntentId = String(body?.paymentIntentId || "").trim();

  if (manual) {
    try {
      await requireAuth();
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const event = await prisma.event.findUnique({ where: { id: Math.trunc(eventId) } });
  if (!event || !event.isActive) {
    return NextResponse.json({ error: "Event not available" }, { status: 404 });
  }

  const remaining = Math.max(0, event.maxTickets - event.soldTickets);
  if (remaining < quantity) {
    return NextResponse.json({ error: "Not enough tickets remaining" }, { status: 409 });
  }

  if (!guestName || !guestEmail) {
    return NextResponse.json({ error: "Guest name and email are required" }, { status: 400 });
  }

  const stripeConfigured = Boolean(await getStripeSecretKey());
  const requiresStripePayment = !manual && event.ticketPrice > 0 && stripeConfigured;

  if (requiresStripePayment && !paymentIntentId) {
    const amount = event.ticketPrice * quantity;
    if (amount < 50) {
      return NextResponse.json({ error: "Minimum payment amount is $0.50" }, { status: 400 });
    }

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

  if (requiresStripePayment && paymentIntentId) {
    const existingByIntent = await prisma.eventTicket.findMany({
      where: { eventId: event.id, stripePaymentIntentId: paymentIntentId },
      orderBy: { createdAt: "asc" },
    });
    if (existingByIntent.length > 0) {
      const ics = await generateEventICS({
        id: event.id,
        name: event.name,
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        ticketCode: existingByIntent[0].code,
      });
      return NextResponse.json({
        tickets: existingByIntent,
        calendarIcs: ics,
      });
    }

    const intent = await stripePaymentStatus(paymentIntentId);
    if (intent.status !== "succeeded") {
      return NextResponse.json({ error: "Payment is not completed" }, { status: 409 });
    }

    const totalRequired = event.ticketPrice * quantity;
    if ((intent.amount_received || 0) < totalRequired) {
      return NextResponse.json({ error: "Insufficient paid amount" }, { status: 409 });
    }
  }

  const guestId = await ensureGuest(guestName, guestEmail, guestPhoneRaw, guestPhone);

  const perTicketPaid = manual
    ? (manualPaid ? event.ticketPrice : 0)
    : (requiresStripePayment ? event.ticketPrice : 0);

  const createdTickets = await prisma.$transaction(async tx => {
    const latest = await tx.event.findUnique({ where: { id: event.id } });
    if (!latest || !latest.isActive) throw new Error("Event unavailable");
    if (latest.soldTickets + quantity > latest.maxTickets) throw new Error("Sold out");

    const tickets = [] as Awaited<ReturnType<typeof tx.eventTicket.create>>[];
    for (let i = 0; i < quantity; i += 1) {
      const code = await uniqueTicketCode(tx);
      const ticket = await tx.eventTicket.create({
        data: {
          eventId: latest.id,
          guestName,
          guestEmail,
          guestPhone: guestPhone || guestPhoneRaw || null,
          quantity: 1,
          totalPaid: perTicketPaid,
          stripePaymentIntentId: requiresStripePayment ? paymentIntentId : null,
          status: "confirmed",
          code,
          guestId,
        },
      });
      tickets.push(ticket);
    }

    await tx.event.update({
      where: { id: latest.id },
      data: { soldTickets: { increment: quantity } },
    });

    return tickets;
  });

  const restaurantName = await getRestaurantName();
  const ticketCodes = createdTickets.map(ticket => ticket.code);
  const ics = await generateEventICS({
    id: event.id,
    name: event.name,
    date: event.date,
    startTime: event.startTime,
    endTime: event.endTime,
    ticketCode: ticketCodes[0],
  });

  const appUrl = getAppUrlFromRequest(req);
  await sendNotification({
    templateId: "event_ticket_confirmation",
    to: guestEmail,
    messageType: "event_ticket_confirmation",
    attachments: [{ filename: `${event.slug}.ics`, content: ics, contentType: "text/calendar" }],
    variables: {
      restaurantName,
      guestName,
      eventName: event.name,
      eventDate: event.date,
      eventTime: `${formatTime12(event.startTime)}${event.endTime ? ` - ${formatTime12(event.endTime)}` : ""}`,
      ticketCount: String(createdTickets.length),
      ticketTotal: `$${(createdTickets.reduce((sum, t) => sum + t.totalPaid, 0) / 100).toFixed(2)}`,
      ticketUrl: `${appUrl}/events/${event.slug}`,
      ticketCodes: ticketCodes.join("\n"),
    },
  });

  return NextResponse.json({
    tickets: createdTickets,
    calendarIcs: ics,
  });
}
