import { prisma } from "@/lib/db";

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const FALLBACK_TIMEZONE = "America/New_York";

function toParts(date: Date, timezone: string): ZonedParts {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || FALLBACK_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: FALLBACK_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }
  const byType = new Map<string, string>();
  for (const part of formatter.formatToParts(date)) {
    byType.set(part.type, part.value);
  }
  return {
    year: Number(byType.get("year") || "1970"),
    month: Number(byType.get("month") || "01"),
    day: Number(byType.get("day") || "01"),
    hour: Number(byType.get("hour") || "00"),
    minute: Number(byType.get("minute") || "00"),
    second: Number(byType.get("second") || "00"),
  };
}

function pad2(value: number): string {
  return String(Math.max(0, Math.trunc(value))).padStart(2, "0");
}

function formatDateParts(parts: { year: number; month: number; day: number }): string {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function parseDateAndTime(date: string, time: string): { year: number; month: number; day: number; hour: number; minute: number } | null {
  const dateMatch = String(date || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = String(time || "").trim().match(/^(\d{2}):(\d{2})$/);
  if (!dateMatch || !timeMatch) return null;
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return { year, month, day, hour, minute };
}

export async function getRestaurantTimezone(): Promise<string> {
  const setting = await prisma.setting.findUnique({ where: { key: "timezone" } });
  const timezone = String(setting?.value || "").trim();
  return timezone || FALLBACK_TIMEZONE;
}

export function getTodayInTimezone(timezone: string): string {
  return formatDateParts(toParts(new Date(), timezone || FALLBACK_TIMEZONE));
}

export function addDaysToDateString(date: string, days: number): string {
  const match = String(date || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return date;
  const base = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0));
  base.setUTCDate(base.getUTCDate() + Math.trunc(days));
  return `${base.getUTCFullYear()}-${pad2(base.getUTCMonth() + 1)}-${pad2(base.getUTCDate())}`;
}

export function getTomorrowInTimezone(timezone: string): string {
  return addDaysToDateString(getTodayInTimezone(timezone), 1);
}

export function getCurrentTimeInTimezone(timezone: string): string {
  const parts = toParts(new Date(), timezone || FALLBACK_TIMEZONE);
  return `${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

export function restaurantDateTimeToUTC(date: string, time: string, timezone: string): Date {
  const parsed = parseDateAndTime(date, time);
  if (!parsed) return new Date(NaN);
  const zone = timezone || FALLBACK_TIMEZONE;

  // Step 1: create a UTC timestamp that treats the restaurant wall-clock time as UTC.
  const utcGuessMs = Date.UTC(parsed.year, parsed.month - 1, parsed.day, parsed.hour, parsed.minute, 0);

  // Step 2: ask Intl what wall-clock time this UTC moment maps to in the target timezone.
  const zoned = toParts(new Date(utcGuessMs), zone);
  const zonedAsUtcMs = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute, zoned.second);

  // Step 3: offset between guessed wall time and actual wall time in timezone.
  const offsetMs = zonedAsUtcMs - utcGuessMs;
  return new Date(utcGuessMs - offsetMs);
}

export function isWithinHours(date: string, time: string, timezone: string, hours: number): boolean {
  const reservationUTC = restaurantDateTimeToUTC(date, time, timezone);
  if (Number.isNaN(reservationUTC.getTime())) return false;
  const diffMs = reservationUTC.getTime() - Date.now();
  return diffMs > 0 && diffMs <= Math.max(0, hours) * 60 * 60 * 1000;
}
