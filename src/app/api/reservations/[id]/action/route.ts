import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { timeToMinutes, minutesToTime } from "@/lib/availability";
import { notifyApproved, notifyDeclined, notifyCancelled } from "@/lib/notifications";
import { updateGuestStats } from "@/lib/guest";
import { getSettings } from "@/lib/settings";
import { chargeNoShow, releasePayment } from "@/lib/payments";
import { sendEmail } from "@/lib/email";
import { sendSms } from "@/lib/sms";

function formatMoneyCents(cents: number): string {
  return `$${(Math.max(0, cents) / 100).toFixed(2)}`;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const { id } = await params;
  const body = await req.json();
  const { action } = body;
  const reservation = await prisma.reservation.findUnique({
    where: { id: parseInt(id) },
    include: { payment: true },
  });
  if (!reservation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date();
  const update: Record<string, unknown> = { updatedAt: now };

  switch (action) {
    case "approve":
      if (!["pending", "counter_offered"].includes(reservation.status)) return NextResponse.json({ error: `Cannot approve from ${reservation.status}` }, { status: 400 });
      update.status = "approved"; update.approvedAt = now; if (body.tableId) update.tableId = body.tableId; break;
    case "decline":
      if (!["pending", "counter_offered"].includes(reservation.status)) return NextResponse.json({ error: `Cannot decline from ${reservation.status}` }, { status: 400 });
      update.status = "declined"; break;
    case "counter":
      if (reservation.status !== "pending") return NextResponse.json({ error: `Cannot counter from ${reservation.status}` }, { status: 400 });
      if (!body.newTime) return NextResponse.json({ error: "newTime required" }, { status: 400 });
      update.status = "counter_offered"; update.originalTime = reservation.time; update.time = body.newTime;
      update.endTime = minutesToTime(timeToMinutes(body.newTime) + reservation.durationMin);
      update.counterExpires = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(); break;
    case "arrive":
      if (!["approved", "confirmed"].includes(reservation.status)) return NextResponse.json({ error: `Cannot arrive from ${reservation.status}` }, { status: 400 });
      update.status = "arrived"; update.arrivedAt = now; break;
    case "seat":
      if (!["arrived", "approved", "confirmed"].includes(reservation.status)) return NextResponse.json({ error: `Cannot seat from ${reservation.status}` }, { status: 400 });
      update.status = "seated"; update.seatedAt = now; if (body.tableId) update.tableId = body.tableId; break;
    case "complete":
      if (reservation.status !== "seated") return NextResponse.json({ error: `Cannot complete from ${reservation.status}` }, { status: 400 });
      update.status = "completed"; update.completedAt = now; break;
    case "noshow":
      if (!["approved", "confirmed", "arrived"].includes(reservation.status)) return NextResponse.json({ error: `Cannot noshow from ${reservation.status}` }, { status: 400 });
      update.status = "no_show"; break;
    case "cancel":
      if (["completed", "no_show", "cancelled"].includes(reservation.status)) return NextResponse.json({ error: `Cannot cancel from ${reservation.status}` }, { status: 400 });
      update.status = "cancelled"; update.cancelledAt = now; break;
    default: return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }

  const updated = await prisma.reservation.update({
    where: { id: parseInt(id) },
    data: update,
    include: { table: true, payment: true },
  });
  if (["complete", "noshow"].includes(action) && updated.guestId) {
    updateGuestStats(updated.guestId).catch(console.error);
  }
  if (action === "complete" && updated.payment?.type === "hold" && updated.payment?.status === "pending" && updated.payment?.stripePaymentIntentId) {
    try {
      await releasePayment(updated.payment.stripePaymentIntentId);
      await prisma.reservationPayment.update({
        where: { reservationId: updated.id },
        data: { status: "released", updatedAt: new Date() },
      });
    } catch (err) {
      console.error("[PAYMENT RELEASE ERROR]", err);
    }
  }
  if (action === "noshow" && updated.payment) {
    try {
      const settings = await getSettings();
      if (settings.noshowChargeEnabled) {
        const charged = await chargeNoShow(updated.id);
        if (charged.ok) {
          const amount = charged.chargedAmount ?? Math.max(0, settings.noshowChargeAmount || updated.payment.amount || 0);
          const appUrl = process.env.APP_URL || "http://localhost:3000";
          const msg = `You were marked as a no-show for your reservation on ${updated.date}. A charge of ${formatMoneyCents(amount)} has been applied to your card.\nManage your reservation: ${appUrl}/reservation/manage`;
          if (updated.guestEmail) {
            await sendEmail({
              to: updated.guestEmail,
              subject: "No-show charge notice",
              body: msg,
              reservationId: updated.id,
              messageType: "noshow_charge_notice",
            });
          }
          if (updated.guestPhone) {
            await sendSms({
              to: updated.guestPhone,
              body: msg,
              reservationId: updated.id,
              messageType: "noshow_charge_notice",
            });
          }
        }
      }
    } catch (err) {
      console.error("[NOSHOW CHARGE ERROR]", err);
    }
  }
  if (action === "approve") notifyApproved(updated).catch(console.error);
  if (action === "decline") notifyDeclined(updated).catch(console.error);
  if (action === "cancel") notifyCancelled(updated).catch(console.error);
  return NextResponse.json(updated);
}
