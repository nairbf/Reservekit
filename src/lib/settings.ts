import { prisma } from "./db";

export async function getSettings() {
  const rows = await prisma.setting.findMany();
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;
  const reserveRequestSamplesRaw = map.reserveRequestSamples || "Birthday celebration,Window seat,High chair";
  const reserveRequestSamples = reserveRequestSamplesRaw.split(",").map(s => s.trim()).filter(Boolean);
  return {
    restaurantName: map.restaurantName || "Restaurant",
    timezone: map.timezone || "America/New_York",
    openTime: map.openTime || "17:00",
    closeTime: map.closeTime || "22:00",
    slotInterval: parseInt(map.slotInterval || "30"),
    maxCoversPerSlot: parseInt(map.maxCoversPerSlot || "40"),
    maxPartySize: parseInt(map.maxPartySize || "8"),
    diningDurations: JSON.parse(map.diningDurations || "{}") as Record<string, number>,
    depositsEnabled: map.depositsEnabled === "true",
    depositAmount: parseFloat(map.depositAmount || "0") || 0,
    depositMinParty: parseInt(map.depositMinParty || "2") || 2,
    depositMessage: map.depositMessage || "A refundable deposit may be required to hold your table.",
    reserveHeading: map.reserveHeading || "Reserve a Table",
    reserveSubheading: map.reserveSubheading || "Choose your date, time, and party size.",
    reserveConfirmationMessage: map.reserveConfirmationMessage || "We'll contact you shortly to confirm.",
    reserveRequestDisclaimer: map.reserveRequestDisclaimer || "Your request will be reviewed and confirmed shortly.",
    reserveRequestPlaceholder: map.reserveRequestPlaceholder || "e.g., Birthday dinner, window seat, stroller space",
    reserveRequestSamples,
  };
}

export function getDiningDuration(durations: Record<string, number>, partySize: number): number {
  return durations[String(partySize)] || durations[String(8)] || 90;
}
