import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendSms } from "@/lib/sms";
import { smsReminder } from "@/lib/sms-templates";
import { sendNotification } from "@/lib/send-notification";
import { addDaysToDateString, getRestaurantTimezone, getTodayInTimezone, isWithinHours } from "@/lib/timezone";

function formatTime12(value: string): string {
  const [h, m] = String(value || "00:00").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return value;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function formatDateLabel(value: string): string {
  const dt = new Date(`${value}T12:00:00`);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET || "";
  const provided = req.headers.get("x-cron-secret") || "";
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const timezone = await getRestaurantTimezone();
  const todayDate = getTodayInTimezone(timezone);
  const reminderHoursSetting = await prisma.setting.findUnique({ where: { key: "reminderLeadHours" } });
  const reminderTimingSetting = await prisma.setting.findUnique({ where: { key: "emailReminderTiming" } });
  const reminderHours = Math.max(
    1,
    parseInt(reminderHoursSetting?.value || reminderTimingSetting?.value || "24", 10) || 24,
  );
  const lookAheadDays = Math.max(1, Math.ceil(reminderHours / 24) + 1);
  const endDate = addDaysToDateString(todayDate, lookAheadDays);
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  const rows = await prisma.reservation.findMany({
    where: {
      date: { gte: todayDate, lte: endDate },
      status: { in: ["approved", "confirmed"] },
      remindedAt: null,
    },
    orderBy: { time: "asc" },
  });

  let sent = 0;
  for (const reservation of rows) {
    if (!isWithinHours(reservation.date, reservation.time, timezone, reminderHours)) continue;

    if (reservation.guestEmail) {
      await sendNotification({
        templateId: "reservation_reminder",
        to: reservation.guestEmail,
        variables: {
          guestName: reservation.guestName,
          date: formatDateLabel(reservation.date),
          time: formatTime12(reservation.time),
          partySize: String(reservation.partySize),
          confirmationCode: reservation.code,
          manageUrl: `${appUrl}/reservation/manage?code=${encodeURIComponent(reservation.code)}`,
        },
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

  return NextResponse.json({
    ok: true,
    timezone,
    today: todayDate,
    reminderHours,
    sent,
  });
}
