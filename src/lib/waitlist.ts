import { prisma } from "./db";

export interface WaitlistEstimateResult {
  estimatedMinutes: number;
  partiesAhead: number;
}

function bucketForPartySize(partySize: number): "small" | "medium" | "large" {
  if (partySize <= 2) return "small";
  if (partySize <= 4) return "medium";
  return "large";
}

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export async function getAverageTurnMinutesByBucket() {
  const now = new Date();
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const rows = await prisma.reservation.findMany({
    where: {
      status: "completed",
      seatedAt: { not: null },
      completedAt: { not: null, gte: since },
    },
    select: {
      partySize: true,
      seatedAt: true,
      completedAt: true,
    },
  });

  const sums: Record<"small" | "medium" | "large", { total: number; count: number }> = {
    small: { total: 0, count: 0 },
    medium: { total: 0, count: 0 },
    large: { total: 0, count: 0 },
  };

  for (const row of rows) {
    if (!row.seatedAt || !row.completedAt) continue;
    const diff = Math.round((row.completedAt.getTime() - row.seatedAt.getTime()) / 60000);
    if (!Number.isFinite(diff) || diff <= 0) continue;
    const bucket = bucketForPartySize(row.partySize);
    sums[bucket].total += diff;
    sums[bucket].count += 1;
  }

  const defaults = { small: 15, medium: 15, large: 15 };
  return {
    small: sums.small.count ? Math.max(10, Math.round(sums.small.total / sums.small.count)) : defaults.small,
    medium: sums.medium.count ? Math.max(10, Math.round(sums.medium.total / sums.medium.count)) : defaults.medium,
    large: sums.large.count ? Math.max(10, Math.round(sums.large.total / sums.large.count)) : defaults.large,
  };
}

export async function estimateWaitMinutes(
  partySize: number,
  entries: Array<{ partySize: number; status: string }>,
): Promise<WaitlistEstimateResult> {
  const active = entries.filter(e => ["waiting", "notified"].includes(e.status));
  const partiesAhead = active.filter(e => e.partySize >= partySize).length;
  const averages = await getAverageTurnMinutesByBucket();
  const bucket = bucketForPartySize(partySize);
  const perParty = averages[bucket] || 15;
  return {
    estimatedMinutes: Math.max(0, partiesAhead * perParty),
    partiesAhead,
  };
}

export async function getTodaysWaitlist(status?: string) {
  const { start, end } = todayRange();
  return prisma.waitlistEntry.findMany({
    where: {
      quotedAt: { gte: start, lt: end },
      ...(status ? { status } : {}),
    },
    orderBy: [{ position: "asc" }, { quotedAt: "asc" }],
  });
}

export async function reorderActiveWaitlistPositions() {
  const { start, end } = todayRange();
  const active = await prisma.waitlistEntry.findMany({
    where: {
      quotedAt: { gte: start, lt: end },
      status: { in: ["waiting", "notified"] },
    },
    orderBy: [{ position: "asc" }, { quotedAt: "asc" }],
  });

  let pos = 1;
  for (const row of active) {
    if (row.position !== pos) {
      await prisma.waitlistEntry.update({
        where: { id: row.id },
        data: { position: pos, updatedAt: new Date() },
      });
    }
    pos += 1;
  }
}
