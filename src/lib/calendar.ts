import { prisma } from "./db";

interface ReservationLike {
  id: number;
  code: string;
  guestName: string;
  partySize: number;
  date: string;
  time: string;
  durationMin: number;
}

interface EventLike {
  id: number;
  name: string;
  date: string;
  startTime: string;
  endTime?: string | null;
  ticketCode?: string;
}

function toICSDateTime(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeICS(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export async function generateICS(reservation: ReservationLike): Promise<string> {
  const settings = await prisma.setting.findMany({
    where: { key: { in: ["restaurantName", "address"] } },
  });
  const map: Record<string, string> = {};
  for (const row of settings) map[row.key] = row.value;

  const restaurantName = map.restaurantName || "Restaurant";
  const location = map.address || "";
  const start = new Date(`${reservation.date}T${reservation.time}:00`);
  const end = new Date(start.getTime() + Math.max(30, reservation.durationMin || 90) * 60000);
  const now = new Date();
  const uid = `reservation-${reservation.id}@reservesit`;
  const description = `Reservation code: ${reservation.code}\\nGuest: ${reservation.guestName}\\nParty size: ${reservation.partySize}`;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ReserveSit//Reservations//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toICSDateTime(now)}`,
    `DTSTART:${toICSDateTime(start)}`,
    `DTEND:${toICSDateTime(end)}`,
    `SUMMARY:${escapeICS(`${restaurantName} Reservation`)}`,
    `DESCRIPTION:${escapeICS(description)}`,
    `LOCATION:${escapeICS(location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export async function generateEventICS(event: EventLike): Promise<string> {
  const start = new Date(`${event.date}T${event.startTime}:00`);
  const end = event.endTime
    ? new Date(`${event.date}T${event.endTime}:00`)
    : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const now = new Date();
  const uid = `event-${event.id}@reservesit`;
  const description = event.ticketCode
    ? `Ticket code: ${event.ticketCode}`
    : "Event ticket";

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ReserveSit//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toICSDateTime(now)}`,
    `DTSTART:${toICSDateTime(start)}`,
    `DTEND:${toICSDateTime(end)}`,
    `SUMMARY:${escapeICS(event.name)}`,
    `DESCRIPTION:${escapeICS(description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
