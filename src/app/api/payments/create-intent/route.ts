import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { createPaymentIntent, type ReservationPaymentType } from "@/lib/payments";
import { getStripeInstance } from "@/lib/stripe";

function last4(value: string): string {
  return String(value || "").replace(/\D/g, "").slice(-4);
}

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

    const reservationCode = String(body?.reservationCode || "").trim().toUpperCase();
    const guestPhone = String(body?.guestPhone || "").trim();
    if (!reservationCode || last4(guestPhone).length !== 4) {
      return NextResponse.json({ error: "reservationCode and guestPhone are required" }, { status: 400 });
    }
    if (reservation.code !== reservationCode || last4(reservation.guestPhone || "") !== last4(guestPhone)) {
      return NextResponse.json({ error: "Reservation verification failed" }, { status: 403 });
    }

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

    if (reservation.payment?.status === "pending" && reservation.payment.stripePaymentIntentId) {
      const existingIntentId = reservation.payment.stripePaymentIntentId;
      const stripe = await getStripeInstance();
      if (stripe) {
        try {
          const existingIntent = await stripe.paymentIntents.retrieve(existingIntentId);
          if (
            ["requires_payment_method", "requires_confirmation", "requires_action", "processing"].includes(existingIntent.status)
            && reservation.payment.amount === amount
            && reservation.payment.type === type
          ) {
            return NextResponse.json({
              clientSecret: existingIntent.client_secret,
              payment: reservation.payment,
            });
          }
          if (["requires_payment_method", "requires_confirmation", "requires_action", "processing", "requires_capture"].includes(existingIntent.status)) {
            try {
              await stripe.paymentIntents.cancel(existingIntentId);
            } catch {
              // Ignore cancellation failures and continue with a fresh intent.
            }
          }
        } catch {
          // Payment intent no longer exists, create a new one below.
        }
        await prisma.reservationPayment.update({
          where: { id: reservation.payment.id },
          data: {
            status: "cancelled",
            updatedAt: new Date(),
          },
        });
      }
    }

    const intent = await createPaymentIntent({
      amount,
      currency: "usd",
      type,
      metadata: {
        reservationId: String(reservation.id),
        reservationCode: reservation.code,
        guestPhone: reservation.guestPhone || guestPhone,
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
