import { prisma } from "./db";

export async function getSettings() {
  const rows = await prisma.setting.findMany();
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;
  return {
    restaurantName: map.restaurantName || "Restaurant",
    timezone: map.timezone || "America/New_York",
    openTime: map.openTime || "17:00",
    closeTime: map.closeTime || "22:00",
    slotInterval: parseInt(map.slotInterval || "30"),
    maxCoversPerSlot: parseInt(map.maxCoversPerSlot || "40"),
    maxPartySize: parseInt(map.maxPartySize || "8"),
    diningDurations: JSON.parse(map.diningDurations || "{}") as Record<string, number>,
  };
}

export function getDiningDuration(durations: Record<string, number>, partySize: number): number {
  return durations[String(partySize)] || durations[String(8)] || 90;
}
