import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { sendSms } from "@/lib/sms";
import { smsReminder } from "@/lib/sms-templates";

function formatTime12(value: string): string {
  const [h, m] = String(value || "00:00").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return value;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET || "";
  const provided = req.headers.get("x-cron-secret") || "";
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = tomorrow.toISOString().split("T")[0];
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const restaurantName = (await prisma.setting.findUnique({ where: { key: "restaurantName" } }))?.value || "Restaurant";

  const rows = await prisma.reservation.findMany({
    where: {
      date: tomorrowDate,
      status: { in: ["approved", "confirmed"] },
      remindedAt: null,
    },
    orderBy: { time: "asc" },
  });

  let sent = 0;
  for (const reservation of rows) {
    const body = [
      `Hi ${reservation.guestName},`,
      "",
      `Reminder: Your reservation is tomorrow at ${restaurantName}.`,
      `Date: ${reservation.date}`,
      `Time: ${formatTime12(reservation.time)}`,
      `Party size: ${reservation.partySize}`,
      `Reservation code: ${reservation.code}`,
      "",
      `Manage your reservation: ${appUrl}/reserve/${encodeURIComponent("test")}`,
      "",
      `— ${restaurantName}`,
    ].join("\n");

    if (reservation.guestEmail) {
      await sendEmail({
        to: reservation.guestEmail,
        subject: `Reminder: Your reservation tomorrow at ${restaurantName}`,
        body,
        reservationId: reservation.id,
        messageType: "reminder",
      });
    }
    if (reservation.guestPhone) {
      const smsBody = await smsReminder({
        code: reservation.code,
        guestName: reservation.guestName,
        partySize: reservation.partySize,
        date: reservation.date,
        time: reservation.time,
      });
      await sendSms({
        to: reservation.guestPhone,
        body: smsBody,
        reservationId: reservation.id,
        messageType: "reminder",
      });
    }

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { remindedAt: new Date() },
    });
    sent += 1;
  }

  return NextResponse.json({ ok: true, date: tomorrowDate, sent });
}
