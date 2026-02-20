import { prisma } from "@/lib/db";

export interface TurnTimeStats {
  overall: number;
  byPartySize: Record<number, number>;
  byTable: Record<number, number>;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export async function calculateTurnTimes(): Promise<TurnTimeStats> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const reservations = await prisma.reservation.findMany({
    where: {
      status: "completed",
      seatedAt: { not: null, gte: thirtyDaysAgo },
      completedAt: { not: null },
    },
    select: {
      partySize: true,
      tableId: true,
      seatedAt: true,
      completedAt: true,
    },
  });

  if (reservations.length === 0) {
    return { overall: 60, byPartySize: {}, byTable: {} };
  }

  const durations: number[] = [];
  const bySizeBuckets: Record<number, number[]> = {};
  const byTableBuckets: Record<number, number[]> = {};

  for (const reservation of reservations) {
    if (!reservation.seatedAt || !reservation.completedAt) continue;
    const minutes = (reservation.completedAt.getTime() - reservation.seatedAt.getTime()) / 60000;
    if (!Number.isFinite(minutes) || minutes < 5 || minutes > 300) continue;

    durations.push(minutes);

    if (!bySizeBuckets[reservation.partySize]) bySizeBuckets[reservation.partySize] = [];
    bySizeBuckets[reservation.partySize].push(minutes);

    if (reservation.tableId) {
      if (!byTableBuckets[reservation.tableId]) byTableBuckets[reservation.tableId] = [];
      byTableBuckets[reservation.tableId].push(minutes);
    }
  }

  const byPartySize = Object.fromEntries(
    Object.entries(bySizeBuckets).map(([size, list]) => [Number(size), average(list)]),
  ) as Record<number, number>;

  const byTable = Object.fromEntries(
    Object.entries(byTableBuckets).map(([id, list]) => [Number(id), average(list)]),
  ) as Record<number, number>;

  return {
    overall: durations.length > 0 ? average(durations) : 60,
    byPartySize,
    byTable,
  };
}

export async function estimateTableAvailability(tableId: number, partySize: number): Promise<Date | null> {
  const reservation = await prisma.reservation.findFirst({
    where: { tableId, status: "seated" },
    orderBy: { seatedAt: "desc" },
    select: { seatedAt: true, partySize: true },
  });

  if (!reservation?.seatedAt) return null;

  const turnTimes = await calculateTurnTimes();
  const estimatedMinutes =
    turnTimes.byTable[tableId]
    || turnTimes.byPartySize[partySize || reservation.partySize]
    || turnTimes.overall
    || 60;

  return new Date(reservation.seatedAt.getTime() + estimatedMinutes * 60000);
}
