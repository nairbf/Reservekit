import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { getStripeInstance, getStripeWebhookSecret } from "@/lib/stripe";

async function markReservationPaymentCaptured(paymentIntentId: string) {
  const payment = await prisma.reservationPayment.findFirst({
    where: { stripePaymentIntentId: paymentIntentId },
  });
  if (!payment || payment.status === "captured" || payment.status === "refunded") return;

  const now = new Date();
  await prisma.reservationPayment.update({
    where: { id: payment.id },
    data: {
      status: "captured",
      capturedAt: payment.capturedAt ?? now,
      updatedAt: now,
    },
  });
}

async function markReservationPaymentFailed(paymentIntentId: string) {
  const payment = await prisma.reservationPayment.findFirst({
    where: { stripePaymentIntentId: paymentIntentId },
  });
  if (!payment || payment.status === "failed" || payment.status === "captured" || payment.status === "refunded") return;

  await prisma.reservationPayment.update({
    where: { id: payment.id },
    data: {
      status: "failed",
      updatedAt: new Date(),
    },
  });
}

async function markReservationPaymentRefunded(paymentIntentId: string) {
  const payment = await prisma.reservationPayment.findFirst({
    where: { stripePaymentIntentId: paymentIntentId },
  });
  if (!payment || payment.status === "refunded") return;

  const now = new Date();
  await prisma.reservationPayment.update({
    where: { id: payment.id },
    data: {
      status: "refunded",
      refundedAt: payment.refundedAt ?? now,
      updatedAt: now,
    },
  });
}

async function confirmEventTickets(paymentIntentId: string) {
  await prisma.eventTicket.updateMany({
    where: {
      stripePaymentIntentId: paymentIntentId,
      status: { notIn: ["confirmed", "checked_in", "cancelled", "refunded"] },
    },
    data: { status: "confirmed" },
  });
}

async function refundEventTickets(paymentIntentId: string) {
  const refundableTickets = await prisma.eventTicket.findMany({
    where: {
      stripePaymentIntentId: paymentIntentId,
      status: { notIn: ["cancelled", "refunded"] },
    },
    select: { id: true, eventId: true, quantity: true },
  });
  if (refundableTickets.length === 0) return;

  await prisma.$transaction(async (tx) => {
    await tx.eventTicket.updateMany({
      where: { id: { in: refundableTickets.map((ticket) => ticket.id) } },
      data: { status: "refunded" },
    });

    const decrementByEvent = new Map<number, number>();
    for (const ticket of refundableTickets) {
      decrementByEvent.set(ticket.eventId, (decrementByEvent.get(ticket.eventId) || 0) + Math.max(1, ticket.quantity || 1));
    }

    for (const [eventId, decrement] of decrementByEvent) {
      const event = await tx.event.findUnique({
        where: { id: eventId },
        select: { soldTickets: true },
      });
      if (!event) continue;
      await tx.event.update({
        where: { id: eventId },
        data: { soldTickets: Math.max(0, event.soldTickets - decrement) },
      });
    }
  });
}

export async function POST(req: NextRequest) {
  const stripe = await getStripeInstance();
  const webhookSecret = await getStripeWebhookSecret();
  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured — rejecting webhook");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 400 });
  }
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object as Stripe.PaymentIntent;
      const paymentIntentId = String(intent.id || "");
      if (paymentIntentId) {
        await markReservationPaymentCaptured(paymentIntentId);
        await confirmEventTickets(paymentIntentId);
      }
    } else if (event.type === "payment_intent.payment_failed") {
      const intent = event.data.object as Stripe.PaymentIntent;
      const paymentIntentId = String(intent.id || "");
      if (paymentIntentId) {
        await markReservationPaymentFailed(paymentIntentId);
      }
    } else if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : charge.payment_intent?.id || "";
      if (paymentIntentId) {
        await markReservationPaymentRefunded(paymentIntentId);
        await refundEventTickets(paymentIntentId);
      }
    } else if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const paymentIntentId = typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id || "";
      if (session.payment_status === "paid" && paymentIntentId) {
        await markReservationPaymentCaptured(paymentIntentId);
        await confirmEventTickets(paymentIntentId);
      }
    }
  } catch (error) {
    console.error("[STRIPE WEBHOOK] Failed to process event", { type: event.type, error });
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
