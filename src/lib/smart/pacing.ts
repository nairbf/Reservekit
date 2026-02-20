import { prisma } from "@/lib/db";
import { getRestaurantTimezone, getTodayInTimezone } from "@/lib/timezone";

export interface PacingAlert {
  timeSlot: string;
  reservations: number;
  tableCapacity: number;
  utilizationPct: number;
  level: "warning" | "critical";
  message: string;
}

function toHalfHourSlot(time: string): string | null {
  const match = String(time || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  const slotMinute = minute < 30 ? "00" : "30";
  return `${String(hour).padStart(2, "0")}:${slotMinute}`;
}

export async function checkPacingAlerts(): Promise<PacingAlert[]> {
  const timezone = await getRestaurantTimezone();
  const today = getTodayInTimezone(timezone);

  const [reservations, totalTables] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        date: today,
        status: { in: ["confirmed", "pending"] },
      },
      select: { time: true },
    }),
    prisma.restaurantTable.count({ where: { isActive: true } }),
  ]);

  if (totalTables === 0) return [];

  const slotCounts: Record<string, number> = {};
  for (const reservation of reservations) {
    const slot = toHalfHourSlot(reservation.time);
    if (!slot) continue;
    slotCounts[slot] = (slotCounts[slot] || 0) + 1;
  }

  const alerts: PacingAlert[] = [];
  for (const [timeSlot, count] of Object.entries(slotCounts)) {
    const utilizationPct = Math.round((count / totalTables) * 100);
    if (utilizationPct >= 100) {
      alerts.push({
        timeSlot,
        reservations: count,
        tableCapacity: totalTables,
        utilizationPct,
        level: "critical",
        message: `${timeSlot}: ${count} reservations for ${totalTables} tables — overbooked`,
      });
      continue;
    }
    if (utilizationPct >= 80) {
      alerts.push({
        timeSlot,
        reservations: count,
        tableCapacity: totalTables,
        utilizationPct,
        level: "warning",
        message: `${timeSlot}: ${count} reservations for ${totalTables} tables — nearly full`,
      });
    }
  }

  return alerts.sort((a, b) => b.utilizationPct - a.utilizationPct);
}
