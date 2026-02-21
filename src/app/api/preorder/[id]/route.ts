import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { createPaymentIntent, refundPayment } from "@/lib/payments";
import { getStripeInstance } from "@/lib/stripe";
import {
  digitsOnly,
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

function parseId(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

async function hasStaffAuth() {
  try {
    await requireAuth();
    return true;
  } catch {
    return false;
  }
}

function sameLast4(storedPhone: string, incomingPhone: string): boolean {
  return digitsOnly(storedPhone).slice(-4) === digitsOnly(incomingPhone).slice(-4);
}

async function loadPreOrder(id: number) {
  return prisma.preOrder.findUnique({
    where: { id },
    include: {
      reservation: true,
      items: {
        include: { menuItem: true },
        orderBy: [{ guestLabel: "asc" }, { id: "asc" }],
      },
    },
  });
}

function normalizeGuestLabel(value: string | undefined, fallback: string): string {
  const trimmed = String(value || "").trim();
  return trimmed || fallback;
}

function signatureFromLines(lines: Array<{ menuItemId: number; guestLabel: string; quantity: number; specialInstructions: string | null }>) {
  return JSON.stringify(
    lines
      .map(line => ({
        menuItemId: line.menuItemId,
        guestLabel: line.guestLabel.trim(),
        quantity: line.quantity,
        specialInstructions: String(line.specialInstructions || "").trim(),
      }))
      .sort((a, b) =>
        a.guestLabel.localeCompare(b.guestLabel) ||
        a.menuItemId - b.menuItemId ||
        a.quantity - b.quantity ||
        a.specialInstructions.localeCompare(b.specialInstructions),
      ),
  );
}

async function getStripeClient() {
  const stripe = await getStripeInstance();
  if (!stripe) throw new Error("Stripe not configured");
  return stripe;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const preOrderId = parseId(id);
  if (!preOrderId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const preOrder = await loadPreOrder(preOrderId);
  if (!preOrder) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const staff = await hasStaffAuth();
  if (!staff) {
    const { searchParams } = new URL(req.url);
    const code = String(searchParams.get("code") || "").trim().toUpperCase();
    const phone = String(searchParams.get("phone") || "");
    if (!code || digitsOnly(phone).length < 4) {
      return NextResponse.json({ error: "code and phone are required" }, { status: 400 });
    }
    if (preOrder.reservation.code !== code || !sameLast4(preOrder.reservation.guestPhone, phone)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  return NextResponse.json(preOrder);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const preOrderId = parseId(id);
  if (!preOrderId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json();
  const requestedPaymentIntentId = String(body?.stripePaymentIntentId || "").trim();
  const preOrder = await loadPreOrder(preOrderId);
  if (!preOrder) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const staff = await hasStaffAuth();
  if (!staff) {
    const code = String(body?.code || "").trim().toUpperCase();
    const phone = String(body?.phone || "");
    if (!code || digitsOnly(phone).length < 4) {
      return NextResponse.json({ error: "code and phone are required" }, { status: 400 });
    }
    if (preOrder.reservation.code !== code || !sameLast4(preOrder.reservation.guestPhone, phone)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  if (body?.action === "start_preparing" || body?.action === "mark_ready" || body?.action === "complete") {
    if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const transitions: Record<string, { next: string; allowed: string[] }> = {
      start_preparing: { next: "preparing", allowed: ["submitted", "confirmed_by_staff"] },
      mark_ready: { next: "ready", allowed: ["preparing"] },
      complete: { next: "completed", allowed: ["ready"] },
    };
    const transition = transitions[String(body.action)];
    if (!transition) return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    if (!transition.allowed.includes(preOrder.status)) {
      return NextResponse.json({ error: `Cannot ${body.action} from status '${preOrder.status}'` }, { status: 400 });
    }
    const updated = await prisma.preOrder.update({
      where: { id: preOrder.id },
      data: { status: transition.next, updatedAt: new Date() },
      include: {
        reservation: true,
        items: { include: { menuItem: true }, orderBy: [{ guestLabel: "asc" }, { id: "asc" }] },
      },
    });
    return NextResponse.json(updated);
  }

  if (body?.action === "mark_paid") {
    const paymentIntentId = requestedPaymentIntentId || preOrder.stripePaymentIntentId || "";
    if (requestedPaymentIntentId && preOrder.stripePaymentIntentId && requestedPaymentIntentId !== preOrder.stripePaymentIntentId) {
      return NextResponse.json({ error: "Payment intent does not match this pre-order" }, { status: 400 });
    }

    if (!staff && !paymentIntentId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let paidAmount = preOrder.subtotal;
    if (paymentIntentId) {
      try {
        const stripe = await getStripeClient();
        const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
        const amountReceived = intent.amount_received || 0;
        if (!staff) {
          const metadataReservationId = String(intent.metadata?.reservationId || "").trim();
          const metadataReservationCode = String(intent.metadata?.reservationCode || "").trim().toUpperCase();
          const matchesReservation = (
            metadataReservationId === String(preOrder.reservationId)
            || metadataReservationCode === String(preOrder.reservation.code || "").trim().toUpperCase()
          );
          if (!matchesReservation) {
            return NextResponse.json({ error: "Payment intent does not match this pre-order" }, { status: 400 });
          }
        }
        if (!staff && (intent.status !== "succeeded" || amountReceived < preOrder.subtotal)) {
          return NextResponse.json({ error: "Payment not confirmed" }, { status: 402 });
        }
        paidAmount = amountReceived || paidAmount;
      } catch (error) {
        if (!staff && error instanceof Error && error.message === "Stripe not configured") {
          return NextResponse.json({ error: "Payment processing not configured" }, { status: 503 });
        }
        if (!staff) {
          return NextResponse.json({ error: "Payment not confirmed" }, { status: 402 });
        }
      }
    }
    const updated = await prisma.preOrder.update({
      where: { id: preOrder.id },
      data: {
        isPaid: true,
        paidAmount,
        paidAt: new Date(),
        stripePaymentIntentId: paymentIntentId || preOrder.stripePaymentIntentId,
      },
      include: {
        reservation: true,
        items: { include: { menuItem: true }, orderBy: [{ guestLabel: "asc" }, { id: "asc" }] },
      },
    });
    return NextResponse.json(updated);
  }

  const config = await getExpressDiningConfig();
  if (!isBeforeCutoff(preOrder.reservation.date, preOrder.reservation.time, config.cutoffHours)) {
    return NextResponse.json({ error: "Pre-ordering is closed for this reservation." }, { status: 400 });
  }

  const guests = (Array.isArray(body?.guests) ? body.guests : []) as IncomingGuest[];
  const flatItems = (Array.isArray(body?.items) ? body.items : []) as IncomingFlatItem[];
  const specialNotes = body?.specialNotes ? String(body.specialNotes) : null;
  const payNow = Boolean(body?.payNow);
  if (guests.length === 0 && flatItems.length === 0) {
    return NextResponse.json({ error: "Please include guest items when updating a pre-order." }, { status: 400 });
  }

  const requested = flatItems.length > 0
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
  if (requested.length === 0) {
    return NextResponse.json({ error: "Please select at least one menu item." }, { status: 400 });
  }

  const menuItemIds = Array.from(new Set(requested.map(item => item.menuItemId).filter(idVal => idVal > 0)));
  const menuItems = await prisma.menuItem.findMany({
    where: {
      id: { in: menuItemIds },
      isAvailable: true,
      category: { isActive: true },
    },
  });
  const menuMap = new Map(menuItems.map(item => [item.id, item]));
  if (menuMap.size !== menuItemIds.length) {
    return NextResponse.json({ error: "One or more selected items are unavailable." }, { status: 409 });
  }

  const nextLines = requested.map(item => ({
    ...item,
    price: menuMap.get(item.menuItemId)!.price,
  }));
  const subtotal = nextLines.reduce((sum, line) => sum + line.price * line.quantity, 0);

  const prevSignature = signatureFromLines(
    preOrder.items.map(item => ({
      menuItemId: item.menuItemId,
      guestLabel: item.guestLabel,
      quantity: item.quantity,
      specialInstructions: item.specialInstructions,
    })),
  );
  const nextSignature = signatureFromLines(
    nextLines.map(line => ({
      menuItemId: line.menuItemId,
      guestLabel: line.guestLabel,
      quantity: line.quantity,
      specialInstructions: line.specialInstructions,
    })),
  );
  const hasItemChanges = prevSignature !== nextSignature || subtotal !== preOrder.subtotal;

  if ((config.payment === "precharge") && (hasItemChanges || !preOrder.isPaid) && !payNow) {
    return NextResponse.json({ error: "Payment is required to confirm this pre-order." }, { status: 400 });
  }

  let refundedAt: Date | null = null;
  if (hasItemChanges && preOrder.isPaid && preOrder.stripePaymentIntentId) {
    try {
      await refundPayment(preOrder.stripePaymentIntentId);
      refundedAt = new Date();
    } catch (err) {
      console.error("[PREORDER REFUND ERROR]", err);
      return NextResponse.json({ error: "Could not refund previous payment. Try again." }, { status: 500 });
    }
  }

  let clientSecret: string | null = null;
  let nextPaymentIntentId: string | null | undefined = preOrder.stripePaymentIntentId;
  let nextPaid = preOrder.isPaid;
  let nextPaidAmount: number | null | undefined = preOrder.paidAmount;
  let nextPaidAt: Date | null | undefined = preOrder.paidAt;

  if (hasItemChanges) {
    nextPaid = false;
    nextPaidAmount = null;
    nextPaidAt = null;
    nextPaymentIntentId = null;
  }

  if ((payNow && config.payment !== "none") || (config.payment === "precharge" && hasItemChanges)) {
    const intent = await createPaymentIntent({
      amount: subtotal,
      currency: "usd",
      type: "deposit",
      metadata: {
        reservationId: String(preOrder.reservationId),
        reservationCode: preOrder.reservation.code,
        preorder: "true",
      },
    });
    clientSecret = intent.client_secret || null;
    nextPaymentIntentId = intent.id;
    if (intent.status === "succeeded") {
      nextPaid = true;
      nextPaidAmount = intent.amount_received || subtotal;
      nextPaidAt = new Date();
    }
  }

  const updated = await prisma.$transaction(async tx => {
    if (hasItemChanges) {
      await tx.preOrderItem.deleteMany({ where: { preOrderId: preOrder.id } });
    }

    const next = await tx.preOrder.update({
      where: { id: preOrder.id },
      data: {
        status: "modified",
        specialNotes,
        subtotal,
        isPaid: nextPaid,
        stripePaymentIntentId: nextPaymentIntentId,
        paidAmount: nextPaidAmount,
        paidAt: nextPaidAt,
        refundedAt: refundedAt ?? (hasItemChanges ? null : preOrder.refundedAt),
        items: hasItemChanges
          ? {
              create: nextLines.map(item => ({
                menuItemId: item.menuItemId,
                guestLabel: item.guestLabel,
                quantity: item.quantity,
                specialInstructions: item.specialInstructions,
                price: item.price,
              })),
            }
          : undefined,
      },
      include: {
        reservation: true,
        items: { include: { menuItem: true }, orderBy: [{ guestLabel: "asc" }, { id: "asc" }] },
      },
    });

    return next;
  });

  return NextResponse.json({ preOrder: updated, clientSecret, paymentIntentId: nextPaymentIntentId });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const preOrderId = parseId(id);
  if (!preOrderId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const preOrder = await loadPreOrder(preOrderId);
  if (!preOrder) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const staff = await hasStaffAuth();
  if (!staff) {
    const body = await req.json();
    const code = String(body?.code || "").trim().toUpperCase();
    const phone = String(body?.phone || "");
    if (!code || digitsOnly(phone).length < 4) {
      return NextResponse.json({ error: "code and phone are required" }, { status: 400 });
    }
    if (preOrder.reservation.code !== code || !sameLast4(preOrder.reservation.guestPhone, phone)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const config = await getExpressDiningConfig();
    if (!isBeforeCutoff(preOrder.reservation.date, preOrder.reservation.time, config.cutoffHours)) {
      return NextResponse.json({ error: "Pre-ordering is closed for this reservation." }, { status: 400 });
    }
  }

  let refundedAt: Date | null = null;
  if (preOrder.isPaid && preOrder.stripePaymentIntentId) {
    try {
      await refundPayment(preOrder.stripePaymentIntentId);
      refundedAt = new Date();
    } catch (err) {
      console.error("[PREORDER CANCEL REFUND ERROR]", err);
      return NextResponse.json({ error: "Could not refund payment. Try again." }, { status: 500 });
    }
  }

  const updated = await prisma.preOrder.update({
    where: { id: preOrder.id },
    data: {
      status: "cancelled",
      refundedAt,
      isPaid: false,
      updatedAt: new Date(),
    },
    include: {
      reservation: true,
      items: { include: { menuItem: true }, orderBy: [{ guestLabel: "asc" }, { id: "asc" }] },
    },
  });

  return NextResponse.json({ ok: true, preOrder: updated });
}
