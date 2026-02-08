import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendSms } from "@/lib/sms";

function fmt(t: string) { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; }
function twiml(msg: string) { return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response>${msg ? `<Message>${msg}</Message>` : ""}</Response>`, { headers: { "Content-Type": "text/xml" } }); }

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const from = form.get("From") as string;
  const body = (form.get("Body") as string || "").trim().toUpperCase();

  await prisma.notificationLog.create({ data: { channel: "sms", recipient: from, messageType: "guest_reply", body, status: "received" } });

  const reservation = await prisma.reservation.findFirst({
    where: { guestPhone: from, status: { in: ["approved", "confirmed", "counter_offered"] }, date: { gte: new Date().toISOString().split("T")[0] } },
    orderBy: { date: "asc" },
  });

  const rname = (await prisma.setting.findUnique({ where: { key: "restaurantName" } }))?.value || "Restaurant";

  if (!reservation) {
    await sendSms({ to: from, body: `${rname}: We couldn't find an upcoming reservation for this number.`, messageType: "auto_reply" });
    return twiml("");
  }

  if (["YES", "Y", "CONFIRM"].includes(body)) {
    const newStatus = reservation.status === "counter_offered" ? "approved" : "confirmed";
    await prisma.reservation.update({ where: { id: reservation.id }, data: { status: newStatus, updatedAt: new Date() } });
    await sendSms({ to: from, body: `${rname}: Confirmed! See you ${reservation.date} at ${fmt(reservation.time)}. Ref: ${reservation.code}`, reservationId: reservation.id, messageType: "confirmation_ack" });
  } else if (["CANCEL", "NO"].includes(body)) {
    await prisma.reservation.update({ where: { id: reservation.id }, data: { status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() } });
    await sendSms({ to: from, body: `${rname}: Your reservation for ${reservation.date} at ${fmt(reservation.time)} has been cancelled. Ref: ${reservation.code}`, reservationId: reservation.id, messageType: "cancellation_ack" });
  } else {
    await sendSms({ to: from, body: `${rname}: Reply YES to confirm or CANCEL to cancel your reservation.`, reservationId: reservation.id, messageType: "auto_reply" });
  }
  return twiml("");
}
