import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { createPaymentIntent, type ReservationPaymentType } from "@/lib/payments";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const reservationId = Number(body?.reservationId);
    if (!Number.isFinite(reservationId) || reservationId <= 0) {
      return NextResponse.json({ error: "reservationId is required" }, { status: 400 });
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: Math.trunc(reservationId) },
      include: { payment: true },
    });
    if (!reservation) return NextResponse.json({ error: "Reservation not found" }, { status: 404 });

    const settings = await getSettings();
    const requestedType = body?.type === "deposit" ? "deposit" : body?.type === "hold" ? "hold" : settings.depositType;
    const type: ReservationPaymentType = requestedType === "deposit" ? "deposit" : "hold";
    const fallbackAmount = reservation.depositAmount ?? settings.depositAmount;
    const requestedAmount = Number(body?.amount);
    const amount = Number.isFinite(requestedAmount) && requestedAmount > 0 ? Math.trunc(requestedAmount) : Math.max(0, Math.trunc(fallbackAmount));

    if (amount < 50) {
      return NextResponse.json({ error: "Deposit amount must be at least 50 cents" }, { status: 400 });
    }

    if (reservation.payment?.status && reservation.payment.status !== "pending") {
      return NextResponse.json({ error: "Payment already processed for this reservation" }, { status: 409 });
    }

    const intent = await createPaymentIntent({
      amount,
      currency: "usd",
      type,
      metadata: {
        reservationId: String(reservation.id),
        reservationCode: reservation.code,
        guestPhone: reservation.guestPhone || "",
      },
    });

    const payment = await prisma.reservationPayment.upsert({
      where: { reservationId: reservation.id },
      update: {
        type,
        amount,
        currency: "usd",
        stripePaymentIntentId: intent.id,
        status: "pending",
      },
      create: {
        reservationId: reservation.id,
        type,
        amount,
        currency: "usd",
        stripePaymentIntentId: intent.id,
        status: "pending",
      },
    });

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        requiresDeposit: true,
        depositAmount: amount,
      },
    });

    return NextResponse.json({
      clientSecret: intent.client_secret,
      payment,
    });
  } catch (err) {
    console.error("[PAYMENT CREATE INTENT ERROR]", err);
    if (err instanceof Error && err.message === "Stripe not configured") {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to create payment intent" }, { status: 500 });
  }
}
