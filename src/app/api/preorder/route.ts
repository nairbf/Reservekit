import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createPaymentIntent } from "@/lib/payments";
import {
  digitsOnly,
  findReservationByCodeAndPhone,
  getExpressDiningConfig,
  isBeforeCutoff,
} from "@/lib/preorder";

interface IncomingGuest {
  label?: string;
  items?: Array<{
    menuItemId?: number;
    quantity?: number;
    specialInstructions?: string;
  }>;
}

interface IncomingFlatItem {
  menuItemId?: number;
  quantity?: number;
  specialInstructions?: string;
}

function normalizeGuestLabel(value: string | undefined, fallback: string): string {
  const trimmed = String(value || "").trim();
  return trimmed || fallback;
}

export async function POST(req: NextRequest) {
  const config = await getExpressDiningConfig();
  if (!config.enabled) {
    return NextResponse.json({ error: "Express Dining is not enabled." }, { status: 403 });
  }

  const body = await req.json();
  const reservationCode = String(body?.reservationCode || "").trim().toUpperCase();
  const phone = digitsOnly(body?.phone || "");
  const specialNotes = body?.specialNotes ? String(body.specialNotes) : null;
  const payNow = Boolean(body?.payNow);
  const guests = (Array.isArray(body?.guests) ? body.guests : []) as IncomingGuest[];
  const flatItems = (Array.isArray(body?.items) ? body.items : []) as IncomingFlatItem[];

  if (!reservationCode || phone.length < 4) {
    return NextResponse.json({ error: "reservationCode and phone are required." }, { status: 400 });
  }

  const reservation = await findReservationByCodeAndPhone(reservationCode, phone);
  if (!reservation) return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
  if (reservation.preOrder) {
    return NextResponse.json({ error: "A pre-order already exists for this reservation." }, { status: 409 });
  }

  if (new Date(`${reservation.date}T${reservation.time}:00`).getTime() <= Date.now()) {
    return NextResponse.json({ error: "This reservation is in the past." }, { status: 400 });
  }
  if (!isBeforeCutoff(reservation.date, reservation.time, config.cutoffHours)) {
    return NextResponse.json({ error: "Pre-ordering is closed for this reservation." }, { status: 400 });
  }

  const allRequested = flatItems.length > 0
    ? flatItems.map(item => ({
        guestLabel: "Table",
        menuItemId: Math.trunc(Number(item.menuItemId || 0)),
        quantity: Math.max(1, Math.trunc(Number(item.quantity || 1))),
        specialInstructions: item.specialInstructions ? String(item.specialInstructions) : null,
      }))
    : guests.flatMap((guest, idx) =>
        (Array.isArray(guest.items) ? guest.items : []).map(item => ({
          guestLabel: normalizeGuestLabel(guest.label, `Guest ${idx + 1}`),
          menuItemId: Math.trunc(Number(item.menuItemId || 0)),
          quantity: Math.max(1, Math.trunc(Number(item.quantity || 1))),
          specialInstructions: item.specialInstructions ? String(item.specialInstructions) : null,
        })),
      );

  if (allRequested.length === 0) {
    return NextResponse.json({ error: "Please select at least one menu item." }, { status: 400 });
  }

  const menuItemIds = Array.from(new Set(allRequested.map(item => item.menuItemId).filter(id => id > 0)));
  const menuItems = await prisma.menuItem.findMany({
    where: {
      id: { in: menuItemIds },
      isAvailable: true,
      category: { isActive: true, type: { in: ["starter", "drink"] } },
    },
  });
  const menuMap = new Map(menuItems.map(item => [item.id, item]));
  if (menuMap.size !== menuItemIds.length) {
    return NextResponse.json({ error: "One or more selected items are unavailable." }, { status: 409 });
  }

  const lineItems = allRequested.map(item => {
    const menuItem = menuMap.get(item.menuItemId)!;
    return {
      ...item,
      price: menuItem.price,
    };
  });
  const subtotal = lineItems.reduce((sum, line) => sum + line.price * line.quantity, 0);

  if (config.payment === "precharge" && !payNow) {
    return NextResponse.json({ error: "Payment is required to confirm this pre-order." }, { status: 400 });
  }

  let clientSecret: string | null = null;
  let paymentIntentId: string | null = null;
  let isPaid = false;
  let paidAmount: number | null = null;
  let paidAt: Date | null = null;

  if (payNow && config.payment !== "none") {
    const intent = await createPaymentIntent({
      amount: subtotal,
      currency: "usd",
      type: "deposit",
      metadata: {
        reservationId: String(reservation.id),
        reservationCode: reservation.code,
        preorder: "true",
      },
    });
    clientSecret = intent.client_secret || null;
    paymentIntentId = intent.id;
    if (intent.status === "succeeded") {
      isPaid = true;
      paidAmount = intent.amount_received;
      paidAt = new Date();
    }
  }

  const guest = await prisma.guest.findFirst({
    where: {
      OR: [{ phone: reservation.guestPhone }, { phone: phone }],
    },
  });
  if (guest && !reservation.guestId) {
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { guestId: guest.id },
    });
  }

  const created = await prisma.preOrder.create({
    data: {
      reservationId: reservation.id,
      status: "submitted",
      specialNotes,
      subtotal,
      isPaid,
      stripePaymentIntentId: paymentIntentId,
      paidAmount,
      paidAt,
      items: {
        create: lineItems.map(item => ({
          menuItemId: item.menuItemId,
          guestLabel: item.guestLabel,
          quantity: item.quantity,
          specialInstructions: item.specialInstructions,
          price: item.price,
        })),
      },
    },
    include: {
      reservation: true,
      items: { include: { menuItem: true }, orderBy: [{ guestLabel: "asc" }, { id: "asc" }] },
    },
  });

  return NextResponse.json({
    preOrder: created,
    clientSecret,
    paymentIntentId,
  }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const config = await getExpressDiningConfig();
  if (!config.enabled) {
    return NextResponse.json({ error: "Express Dining is not enabled." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const reservationCode = String(searchParams.get("code") || "").trim().toUpperCase();
  const phone = digitsOnly(searchParams.get("phone") || "");
  if (!reservationCode || phone.length < 4) {
    return NextResponse.json({ error: "code and phone are required." }, { status: 400 });
  }

  const reservation = await findReservationByCodeAndPhone(reservationCode, phone);
  if (!reservation) return NextResponse.json({ error: "Reservation not found." }, { status: 404 });

  return NextResponse.json({
    reservation: {
      id: reservation.id,
      code: reservation.code,
      guestName: reservation.guestName,
      date: reservation.date,
      time: reservation.time,
      partySize: reservation.partySize,
      status: reservation.status,
    },
    preOrder: reservation.preOrder,
    config,
    cutoffOpen: isBeforeCutoff(reservation.date, reservation.time, config.cutoffHours),
  });
}
