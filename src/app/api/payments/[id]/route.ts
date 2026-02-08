import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { capturePayment, releasePayment, refundPayment } from "@/lib/payments";

async function findPayment(id: number) {
  const byReservation = await prisma.reservationPayment.findUnique({
    where: { reservationId: id },
  });
  if (byReservation) return byReservation;
  return prisma.reservationPayment.findUnique({ where: { id } });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId) || numericId <= 0) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const payment = await findPayment(Math.trunc(numericId));
  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  return NextResponse.json(payment);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId) || numericId <= 0) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const payment = await findPayment(Math.trunc(numericId));
  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  if (!payment.stripePaymentIntentId) return NextResponse.json({ error: "Payment intent missing" }, { status: 400 });

  const body = await req.json();
  const action = String(body?.action || "");
  const now = new Date();

  try {
    if (action === "capture") {
      await capturePayment(payment.stripePaymentIntentId);
      const updated = await prisma.reservationPayment.update({
        where: { id: payment.id },
        data: { status: "captured", capturedAt: now, updatedAt: now },
      });
      return NextResponse.json(updated);
    }

    if (action === "release") {
      await releasePayment(payment.stripePaymentIntentId);
      const updated = await prisma.reservationPayment.update({
        where: { id: payment.id },
        data: { status: "released", updatedAt: now },
      });
      return NextResponse.json(updated);
    }

    if (action === "refund") {
      const amount = Number(body?.amount);
      await refundPayment(
        payment.stripePaymentIntentId,
        Number.isFinite(amount) && amount > 0 ? Math.trunc(amount) : undefined,
      );
      const updated = await prisma.reservationPayment.update({
        where: { id: payment.id },
        data: { status: "refunded", refundedAt: now, updatedAt: now },
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error("[PAYMENT ACTION ERROR]", err);
    return NextResponse.json({ error: "Payment action failed" }, { status: 500 });
  }
}
