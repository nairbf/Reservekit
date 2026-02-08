import { prisma } from "./db";
import { getSettings, getDiningDuration, getEffectiveScheduleForDate } from "./settings";

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export interface Slot { time: string; available: boolean; reason?: string }

export async function getAvailableSlots(date: string, partySize: number, options?: { excludeReservationId?: number }): Promise<Slot[]> {
  const settings = await getSettings();
  const override = await prisma.dayOverride.findUnique({ where: { date } });
  const effective = getEffectiveScheduleForDate(settings, date, override);
  if (effective.isClosed) return [];

  const openTime = effective.openTime;
  const closeTime = effective.closeTime;
  const maxCovers = effective.maxCovers;
  const duration = getDiningDuration(settings.diningDurations, partySize);
  const openMin = timeToMinutes(openTime);
  const closeMin = timeToMinutes(closeTime);
  if (closeMin <= openMin) return [];
  const lastSeatingBufferMin = Math.max(0, settings.lastSeatingBufferMin);
  const latestStartMin = closeMin - lastSeatingBufferMin;
  if (latestStartMin < openMin) return [];

  const existing = await prisma.reservation.findMany({
    where: {
      date,
      status: { in: ["pending", "approved", "confirmed", "arrived", "seated"] },
      ...(options?.excludeReservationId ? { id: { not: options.excludeReservationId } } : {}),
    },
    select: { time: true, endTime: true, partySize: true },
  });

  const slots: Slot[] = [];
  for (let slotMin = openMin; slotMin <= latestStartMin; slotMin += settings.slotInterval) {
    let overlapCovers = 0;
    for (const res of existing) {
      const resStart = timeToMinutes(res.time);
      const resEnd = timeToMinutes(res.endTime);
      if (resStart < slotMin + duration && resEnd > slotMin) overlapCovers += res.partySize;
    }
    const slotTime = minutesToTime(slotMin);
    slots.push(overlapCovers + partySize > maxCovers ? { time: slotTime, available: false, reason: "fully_booked" } : { time: slotTime, available: true });
  }
  return slots;
}
