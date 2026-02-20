import { prisma } from "@/lib/db";
import { getRestaurantTimezone, getTodayInTimezone } from "@/lib/timezone";
import { getGuestTags } from "./guest-intel";
import { calculateNoShowRisk } from "./no-show-risk";

export interface DailyPrepSummary {
  date: string;
  restaurantName: string;
  totalReservations: number;
  totalCovers: number;
  vipGuests: Array<{ name: string; partySize: number; time: string; visits: number }>;
  largeParties: Array<{ name: string; partySize: number; time: string }>;
  highRiskNoShows: Array<{ name: string; time: string; score: number; reasons: string[] }>;
  peakSlots: Array<{ time: string; reservations: number; capacity: number }>;
  newGuests: number;
}

function toHalfHourSlot(time: string): string | null {
  const match = String(time || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  const slotMinute = minute < 30 ? "00" : "30";
  return `${String(hour).padStart(2, "0")}:${slotMinute}`;
}

function parseVisitCount(detail: string): number {
  const match = String(detail || "").match(/\d+/);
  return match ? Number(match[0]) : 10;
}

export async function generateDailyPrep(): Promise<DailyPrepSummary> {
  const timezone = await getRestaurantTimezone();
  const today = getTodayInTimezone(timezone);

  const [restaurantNameRow, reservations, tableCount] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "restaurantName" } }),
    prisma.reservation.findMany({
      where: {
        date: today,
        status: { in: ["confirmed", "pending"] },
      },
      include: {
        guest: true,
      },
      orderBy: { time: "asc" },
    }),
    prisma.restaurantTable.count({ where: { isActive: true } }),
  ]);

  const restaurantName = restaurantNameRow?.value || "Your Restaurant";
  const totalCovers = reservations.reduce((sum, reservation) => sum + reservation.partySize, 0);

  const vipGuests: DailyPrepSummary["vipGuests"] = [];
  const largeParties: DailyPrepSummary["largeParties"] = [];
  const highRiskNoShows: DailyPrepSummary["highRiskNoShows"] = [];
  let newGuests = 0;

  for (const reservation of reservations) {
    const name = reservation.guest?.name || reservation.guestName || "Guest";

    if (reservation.partySize >= 6) {
      largeParties.push({
        name,
        partySize: reservation.partySize,
        time: reservation.time,
      });
    }

    if (reservation.guestId) {
      const tags = await getGuestTags(reservation.guestId);
      const vipTag = tags.find((tag) => tag.label === "VIP");
      if (vipTag) {
        vipGuests.push({
          name,
          partySize: reservation.partySize,
          time: reservation.time,
          visits: parseVisitCount(vipTag.detail),
        });
      }

      const firstTimeTag = tags.find((tag) => tag.label === "First Time");
      if (firstTimeTag) newGuests += 1;
    } else {
      newGuests += 1;
    }

    const risk = await calculateNoShowRisk(reservation.id);
    if (risk.level === "high") {
      highRiskNoShows.push({
        name,
        time: reservation.time,
        score: risk.score,
        reasons: risk.reasons,
      });
    }
  }

  const slotCounts: Record<string, number> = {};
  for (const reservation of reservations) {
    const slot = toHalfHourSlot(reservation.time);
    if (!slot) continue;
    slotCounts[slot] = (slotCounts[slot] || 0) + 1;
  }

  const peakSlots = Object.entries(slotCounts)
    .map(([time, count]) => ({
      time,
      reservations: count,
      capacity: tableCount,
    }))
    .sort((a, b) => b.reservations - a.reservations)
    .slice(0, 3);

  return {
    date: today,
    restaurantName,
    totalReservations: reservations.length,
    totalCovers,
    vipGuests,
    largeParties,
    highRiskNoShows,
    peakSlots,
    newGuests,
  };
}
