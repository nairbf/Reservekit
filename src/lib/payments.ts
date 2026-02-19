import { prisma } from "./db";
import { getSettings } from "./settings";
import { getStripeInstance } from "./stripe";

export type ReservationPaymentType = "hold" | "deposit";

interface CreatePaymentIntentParams {
  amount: number;
  currency?: string;
  type: ReservationPaymentType;
  metadata?: Record<string, string>;
}

async function getStripeClient() {
  const stripe = await getStripeInstance();
  if (!stripe) throw new Error("Stripe not configured");
  return stripe;
}

export async function createPaymentIntent({
  amount,
  currency = "usd",
  type,
  metadata = {},
}: CreatePaymentIntentParams) {
  const stripe = await getStripeClient();
  const normalizedAmount = Math.max(0, Math.trunc(amount));
  if (normalizedAmount < 50) throw new Error("Minimum amount is 50 cents");

  return stripe.paymentIntents.create({
    amount: normalizedAmount,
    currency,
    capture_method: type === "hold" ? "manual" : "automatic",
    automatic_payment_methods: { enabled: true },
    metadata: {
      ...metadata,
      reservesit_payment_type: type,
    },
  });
}

export async function capturePayment(paymentIntentId: string, amountToCapture?: number) {
  const stripe = await getStripeClient();
  if (typeof amountToCapture === "number" && Number.isFinite(amountToCapture) && amountToCapture > 0) {
    return stripe.paymentIntents.capture(paymentIntentId, {
      amount_to_capture: Math.trunc(amountToCapture),
    });
  }
  return stripe.paymentIntents.capture(paymentIntentId);
}

export async function releasePayment(paymentIntentId: string) {
  const stripe = await getStripeClient();
  return stripe.paymentIntents.cancel(paymentIntentId);
}

export async function refundPayment(paymentIntentId: string, amount?: number) {
  const stripe = await getStripeClient();
  if (typeof amount === "number" && Number.isFinite(amount) && amount > 0) {
    return stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: Math.trunc(amount),
    });
  }
  return stripe.refunds.create({ payment_intent: paymentIntentId });
}

export async function chargeNoShow(reservationId: number) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { payment: true },
  });
  if (!reservation?.payment?.stripePaymentIntentId) {
    return { ok: false, error: "No payment on file" as const };
  }

  const payment = reservation.payment;
  const paymentIntentId = payment.stripePaymentIntentId;
  if (!paymentIntentId) {
    return { ok: false, error: "No payment on file" as const };
  }
  const settings = await getSettings();
  const configuredNoShowAmount = Math.max(0, Math.trunc(settings.noshowChargeAmount));
  const fallbackAmount = Math.max(0, Math.trunc(payment.amount));
  const targetAmount = configuredNoShowAmount > 0 ? configuredNoShowAmount : fallbackAmount;

  let chargedAmount = targetAmount;
  const now = new Date();

  if (payment.type === "hold" && payment.status === "pending") {
    const amountToCapture = Math.max(50, Math.min(targetAmount || payment.amount, payment.amount));
    const captured = await capturePayment(paymentIntentId, amountToCapture);
    chargedAmount = captured.amount_received || amountToCapture;
  }

  await prisma.reservationPayment.update({
    where: { reservationId },
    data: {
      status: "charged_noshow",
      capturedAt: now,
      amount: chargedAmount,
      updatedAt: now,
    },
  });

  await prisma.notificationLog.create({
    data: {
      reservationId,
      channel: "system",
      recipient: "internal",
      messageType: "noshow_charge",
      body: `No-show charge applied (${chargedAmount} cents).`,
      status: "sent",
    },
  });

  return { ok: true, chargedAmount };
}
