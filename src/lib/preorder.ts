import { prisma } from "./db";
import { getSettings } from "./settings";
import { isModuleActive } from "./license";

export interface ExpressDiningConfig {
  licensed: boolean;
  enabled: boolean;
  mode: "prices" | "browse";
  payment: "precharge" | "optional" | "none";
  cutoffHours: number;
  message: string;
}

export function digitsOnly(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

export function reservationDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00`);
}

export function isBeforeCutoff(date: string, time: string, cutoffHours: number): boolean {
  const at = reservationDateTime(date, time).getTime() - cutoffHours * 60 * 60 * 1000;
  return Date.now() < at;
}

export function formatCents(cents: number): string {
  return `$${(Math.max(0, Math.trunc(cents)) / 100).toFixed(2)}`;
}

export function dollarsToCents(value: unknown): number {
  if (typeof value === "number") return Math.max(0, Math.round(value * 100));
  const parsed = parseFloat(String(value || "0").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed * 100));
}

export async function getExpressDiningConfig(): Promise<ExpressDiningConfig> {
  const settings = await getSettings();
  const licensed = await isModuleActive("expressdining");
  return {
    licensed,
    enabled: licensed && settings.expressDiningEnabled,
    mode: settings.expressDiningMode,
    payment: settings.expressDiningPayment,
    cutoffHours: settings.expressDiningCutoffHours,
    message: settings.expressDiningMessage,
  };
}

export async function findReservationByCodeAndPhone(code: string, phone: string) {
  const normalizedCode = String(code || "").trim().toUpperCase();
  const normalizedPhone = digitsOnly(phone);
  if (!normalizedCode || normalizedPhone.length < 4) return null;

  const reservation = await prisma.reservation.findUnique({
    where: { code: normalizedCode },
    include: {
      preOrder: {
        include: {
          items: {
            include: { menuItem: true },
            orderBy: [{ guestLabel: "asc" }, { id: "asc" }],
          },
        },
      },
    },
  });
  if (!reservation) return null;
  if (digitsOnly(reservation.guestPhone).slice(-4) !== normalizedPhone.slice(-4)) return null;
  return reservation;
}

