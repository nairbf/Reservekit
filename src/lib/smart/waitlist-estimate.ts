import { prisma } from "@/lib/db";
import { getRestaurantTimezone, getTodayInTimezone } from "@/lib/timezone";
import { calculateTurnTimes } from "./turn-time";

export interface WaitlistEstimate {
  estimatedMinutes: number;
  estimatedTime: string;
  basedOn: string;
}

function formatTimeInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export async function calculateWaitlistEstimate(
  partySize: number,
  position: number,
): Promise<WaitlistEstimate> {
  const timezone = await getRestaurantTimezone();
  const today = getTodayInTimezone(timezone);
  const now = new Date();

  const seated = await prisma.reservation.findMany({
    where: {
      date: today,
      status: "seated",
      seatedAt: { not: null },
      tableId: { not: null },
    },
    select: {
      tableId: true,
      partySize: true,
      seatedAt: true,
      table: {
        select: {
          maxCapacity: true,
          minCapacity: true,
        },
      },
    },
    orderBy: { seatedAt: "asc" },
  });

  const turnTimes = await calculateTurnTimes();
  const departures: Array<{ tableId: number; capacity: number; expectedAt: Date }> = [];

  for (const reservation of seated) {
    if (!reservation.seatedAt || reservation.tableId == null) continue;
    const averageMinutes =
      turnTimes.byTable[reservation.tableId]
      || turnTimes.byPartySize[reservation.partySize]
      || turnTimes.overall;
    const expectedAt = new Date(reservation.seatedAt.getTime() + averageMinutes * 60_000);
    departures.push({
      tableId: reservation.tableId,
      capacity: reservation.table?.maxCapacity || reservation.table?.minCapacity || 4,
      expectedAt,
    });
  }

  departures.sort((a, b) => a.expectedAt.getTime() - b.expectedAt.getTime());
  const suitableDepartures = departures.filter((entry) => entry.capacity >= partySize);
  const targetIndex = Math.min(Math.max(position - 1, 0), suitableDepartures.length - 1);

  if (suitableDepartures.length === 0 || targetIndex < 0) {
    const fallbackMinutes = Math.max(5, position * 15);
    const fallbackTime = new Date(now.getTime() + fallbackMinutes * 60_000);
    return {
      estimatedMinutes: fallbackMinutes,
      estimatedTime: formatTimeInTimezone(fallbackTime, timezone),
      basedOn: "Estimated based on average wait times",
    };
  }

  const target = suitableDepartures[targetIndex];
  const waitMs = Math.max(target.expectedAt.getTime() - now.getTime(), 0);
  const waitMinutes = Math.round(waitMs / 60_000);
  const roundedMinutes = Math.max(5, Math.ceil(waitMinutes / 5) * 5);
  const estimatedAt = new Date(now.getTime() + roundedMinutes * 60_000);

  return {
    estimatedMinutes: roundedMinutes,
    estimatedTime: formatTimeInTimezone(estimatedAt, timezone),
    basedOn: `${suitableDepartures.length} table${suitableDepartures.length === 1 ? "" : "s"} expected to free up`,
  };
}
