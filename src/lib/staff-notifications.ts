import { prisma } from "./db";
import { sendEmail } from "./email";

interface ReservationLike {
  id: number;
  code: string;
  guestName: string;
  date: string;
  time: string;
  partySize: number;
}

function formatTime12(value: string): string {
  const [h, m] = String(value || "00:00").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return value;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

async function getStaffNotificationConfig() {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ["staffNotificationEmail", "staffNotificationsEnabled", "largePartyThreshold"] } },
  });
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;
  return {
    enabled: map.staffNotificationsEnabled === "true",
    email: String(map.staffNotificationEmail || "").trim(),
    largePartyThreshold: Math.max(1, parseInt(map.largePartyThreshold || "6", 10) || 6),
  };
}

async function sendStaff(subject: string, body: string, reservation?: ReservationLike) {
  const config = await getStaffNotificationConfig();
  if (!config.enabled || !config.email) return false;
  await sendEmail({
    to: config.email,
    subject,
    body,
    reservationId: reservation?.id,
    messageType: "staff_alert",
  });
  return true;
}

export async function notifyStaffNewRequest(reservation: ReservationLike) {
  return sendStaff(
    "New reservation request",
    `${reservation.guestName} for ${reservation.date} at ${formatTime12(reservation.time)}, party of ${reservation.partySize}. Log in to review.`,
    reservation,
  );
}

export async function notifyStaffCancellation(reservation: ReservationLike) {
  return sendStaff(
    "Reservation cancelled",
    `${reservation.guestName} cancelled their reservation for ${reservation.date} at ${formatTime12(reservation.time)} (was party of ${reservation.partySize}). Ref: ${reservation.code}`,
    reservation,
  );
}

export async function notifyStaffLargeParty(reservation: ReservationLike) {
  const config = await getStaffNotificationConfig();
  if (!config.enabled || !config.email) return false;
  if (reservation.partySize < config.largePartyThreshold) return false;
  await sendEmail({
    to: config.email,
    subject: "Large party alert",
    body: `Heads up: ${reservation.guestName} just requested a table for ${reservation.partySize} on ${reservation.date} at ${formatTime12(reservation.time)}.`,
    reservationId: reservation.id,
    messageType: "staff_alert_large_party",
  });
  return true;
}
