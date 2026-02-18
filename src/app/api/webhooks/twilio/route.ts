import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendSms } from "@/lib/sms";
import { reorderActiveWaitlistPositions } from "@/lib/waitlist";
import { getRestaurantTimezone, getTodayInTimezone } from "@/lib/timezone";

function fmt(t: string) { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; }
function twiml(msg: string) { return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response>${msg ? `<Message>${msg}</Message>` : ""}</Response>`, { headers: { "Content-Type": "text/xml" } }); }
function normalizePhone(value: string) { return String(value || "").replace(/[^\d+]/g, ""); }

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const from = form.get("From") as string;
  const body = (form.get("Body") as string || "").trim().toUpperCase();
  const normalizedFrom = normalizePhone(from);
  const last10 = normalizedFrom.replace(/\D/g, "").slice(-10);

  const timezone = await getRestaurantTimezone();
  const today = getTodayInTimezone(timezone);

  await prisma.notificationLog.create({ data: { channel: "sms", recipient: from, messageType: "guest_reply", body, status: "received" } });

  const reservation = await prisma.reservation.findFirst({
    where: {
      status: { in: ["approved", "confirmed", "counter_offered"] },
      date: { gte: today },
      OR: [
        { guestPhone: from },
        { guestPhone: normalizedFrom },
        ...(last10 ? [{ guestPhone: { endsWith: last10 } }] : []),
      ],
    },
    orderBy: { date: "asc" },
  });

  const rname = (await prisma.setting.findUnique({ where: { key: "restaurantName" } }))?.value || "Restaurant";

  if (reservation && ["YES", "Y", "CONFIRM"].includes(body)) {
    const newStatus = reservation.status === "counter_offered" ? "approved" : "confirmed";
    await prisma.reservation.update({ where: { id: reservation.id }, data: { status: newStatus, updatedAt: new Date() } });
    await sendSms({ to: from, body: `${rname}: Confirmed! See you ${reservation.date} at ${fmt(reservation.time)}. Ref: ${reservation.code}`, reservationId: reservation.id, messageType: "confirmation_ack" });
    return twiml("");
  }

  if (reservation && ["CANCEL", "NO"].includes(body)) {
    await prisma.reservation.update({ where: { id: reservation.id }, data: { status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() } });
    await sendSms({ to: from, body: `${rname}: Your reservation for ${reservation.date} at ${fmt(reservation.time)} has been cancelled. Ref: ${reservation.code}`, reservationId: reservation.id, messageType: "cancellation_ack" });
    return twiml("");
  }

  if (!reservation && ["CANCEL", "NO"].includes(body)) {
    const waitlist = await prisma.waitlistEntry.findFirst({
      where: {
        status: { in: ["waiting", "notified"] },
        OR: [
          { guestPhone: from },
          { guestPhone: normalizedFrom },
          ...(last10 ? [{ guestPhone: { endsWith: last10 } }] : []),
        ],
      },
      orderBy: { quotedAt: "asc" },
    });
    if (waitlist) {
      await prisma.waitlistEntry.update({
        where: { id: waitlist.id },
        data: { status: "cancelled", updatedAt: new Date() },
      });
      await reorderActiveWaitlistPositions();
      await sendSms({
        to: from,
        body: `${rname}: You have been removed from the waitlist. Reply JOIN on our website anytime to add your name again.`,
        messageType: "waitlist_cancel_ack",
      });
      return twiml("");
    }
  }

  if (!reservation) {
    await sendSms({ to: from, body: `${rname}: We couldn't find an upcoming reservation for this number.`, messageType: "auto_reply" });
    return twiml("");
  }

  await sendSms({ to: from, body: `${rname}: Reply YES to confirm or CANCEL to cancel your reservation.`, reservationId: reservation.id, messageType: "auto_reply" });
  return twiml("");
}
