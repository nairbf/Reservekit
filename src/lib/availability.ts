import { prisma } from "./db";
import { getSettings, getDiningDuration } from "./settings";

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export interface Slot { time: string; available: boolean; reason?: string }

export async function getAvailableSlots(date: string, partySize: number): Promise<Slot[]> {
  const settings = await getSettings();
  const override = await prisma.dayOverride.findUnique({ where: { date } });
  if (override?.isClosed) return [];

  const openTime = override?.openTime || settings.openTime;
  const closeTime = override?.closeTime || settings.closeTime;
  const maxCovers = override?.maxCovers || settings.maxCoversPerSlot;
  const duration = getDiningDuration(settings.diningDurations, partySize);
  const openMin = timeToMinutes(openTime);
  const closeMin = timeToMinutes(closeTime);

  const existing = await prisma.reservation.findMany({
    where: { date, status: { in: ["pending", "approved", "confirmed", "arrived", "seated"] } },
    select: { time: true, endTime: true, partySize: true },
  });

  const slots: Slot[] = [];
  for (let slotMin = openMin; slotMin + duration <= closeMin; slotMin += settings.slotInterval) {
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
