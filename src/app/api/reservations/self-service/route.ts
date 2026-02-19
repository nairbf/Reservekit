import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAppUrlFromRequest } from "@/lib/app-url";
import { getAvailableSlots, minutesToTime, timeToMinutes } from "@/lib/availability";
import { getDiningDuration, getSettings } from "@/lib/settings";
import { notifyCancelled } from "@/lib/notifications";
import { releasePayment } from "@/lib/payments";
import { sendEmail } from "@/lib/email";
import { getClientIp, getRateLimitResponse, rateLimit } from "@/lib/rate-limit";
import { sendSms } from "@/lib/sms";
import { notifyStaffCancellation } from "@/lib/staff-notifications";
import { getRestaurantTimezone, restaurantDateTimeToUTC } from "@/lib/timezone";

function digitsOnly(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

function formatTime12(value: string): string {
  const [h, m] = String(value || "00:00").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return value;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = rateLimit("reservation-self-service", ip, 10, 60_000);
  if (!limit.allowed) return getRateLimitResponse();

  const appUrl = getAppUrlFromRequest(req);
  const body = await req.json();
  const code = String(body?.code || "").trim().toUpperCase();
  const phone = digitsOnly(body?.phone || "");
  const action = String(body?.action || "").toLowerCase();
  if (!code || phone.length < 4 || !action) {
    return NextResponse.json({ error: "code, phone, action are required" }, { status: 400 });
  }

  const reservation = await prisma.reservation.findUnique({
    where: { code },
    include: { payment: true },
  });
  if (!reservation) return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  if (digitsOnly(reservation.guestPhone).slice(-4) !== phone.slice(-4)) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  const blockedStatuses = new Set(["arrived", "seated", "completed", "no_show"]);
  const terminalStatuses = new Set(["cancelled", "completed", "no_show"]);
  if (blockedStatuses.has(reservation.status)) {
    return NextResponse.json({ error: "This reservation can no longer be modified online." }, { status: 409 });
  }

  if (action === "cancel") {
    if (terminalStatuses.has(reservation.status)) {
      return NextResponse.json({ error: "Reservation is already closed." }, { status: 409 });
    }

    const updated = await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() },
      include: { table: true },
    });

    if (reservation.payment?.type === "hold" && reservation.payment?.status === "pending" && reservation.payment.stripePaymentIntentId) {
      try {
        await releasePayment(reservation.payment.stripePaymentIntentId);
        await prisma.reservationPayment.update({
          where: { reservationId: reservation.id },
          data: { status: "released", updatedAt: new Date() },
        });
      } catch (err) {
        console.error("[SELF SERVICE HOLD RELEASE ERROR]", err);
      }
    }

    notifyCancelled(updated, appUrl).catch(console.error);
    notifyStaffCancellation(updated).catch(console.error);
    return NextResponse.json({ ok: true, reservation: updated });
  }

  if (action === "modify") {
    if (terminalStatuses.has(reservation.status)) {
      return NextResponse.json({ error: "Reservation is already closed." }, { status: 409 });
    }

    const settings = await getSettings();
    const restaurantPhone = (await prisma.setting.findUnique({ where: { key: "phone" } }))?.value || "";
    const cutoffHours = Math.max(0, parseInt((await prisma.setting.findUnique({ where: { key: "selfServiceCutoffHours" } }))?.value || "2", 10) || 2);
    const timezone = await getRestaurantTimezone();
    const now = new Date();
    const cutoffAt = restaurantDateTimeToUTC(reservation.date, reservation.time, timezone).getTime() - cutoffHours * 60 * 60 * 1000;
    if (Date.now() >= cutoffAt) {
      return NextResponse.json({
        error: `Modifications are no longer available for this reservation. Please call us${restaurantPhone ? ` at ${restaurantPhone}` : ""}.`,
        reason: "cutoff",
        cutoffHours,
        phone: restaurantPhone || null,
      }, { status: 409 });
    }

    const newDate = String(body?.newDate || "").trim();
    const newTime = String(body?.newTime || "").trim();
    const newPartySize = Math.max(1, Math.trunc(Number(body?.newPartySize || reservation.partySize)));
    if (!newDate || !newTime || !newPartySize) {
      return NextResponse.json({ error: "newDate, newTime, and newPartySize are required" }, { status: 400 });
    }

    if (!(newDate === reservation.date && newTime === reservation.time && newPartySize === reservation.partySize)) {
      const slots = await getAvailableSlots(newDate, newPartySize, { excludeReservationId: reservation.id });
      const slot = slots.find(s => s.time === newTime);
      if (!slot || !slot.available) {
        return NextResponse.json({ error: "Selected time is no longer available." }, { status: 409 });
      }
    }

    const duration = getDiningDuration(settings.diningDurations, newPartySize);
    const endTime = minutesToTime(timeToMinutes(newTime) + duration);
    const updated = await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        date: newDate,
        time: newTime,
        partySize: newPartySize,
        durationMin: duration,
        endTime,
        updatedAt: now,
      },
      include: { table: true },
    });

    const manageLink = `${appUrl}/reservation/manage`;
    const message = `Your reservation has been updated to ${updated.date} at ${formatTime12(updated.time)} for party of ${updated.partySize}.\nRef: ${updated.code}\nManage your reservation: ${manageLink}`;

    if (updated.guestEmail) {
      await sendEmail({
        to: updated.guestEmail,
        subject: "Reservation updated",
        body: message,
        reservationId: updated.id,
        messageType: "self_service_modify",
      });
    }
    if (updated.guestPhone) {
      await sendSms({
        to: updated.guestPhone,
        body: message,
        reservationId: updated.id,
        messageType: "self_service_modify",
      });
    }

    await prisma.notificationLog.create({
      data: {
        reservationId: updated.id,
        channel: "system",
        recipient: "staff",
        messageType: "self_service_modify",
        body: `${updated.guestName} modified reservation to ${updated.date} ${updated.time}, party ${updated.partySize}.`,
        status: "sent",
      },
    });

    return NextResponse.json({ ok: true, reservation: updated });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
