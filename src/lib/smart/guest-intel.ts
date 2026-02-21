import { prisma } from "@/lib/db";

export interface GuestTag {
  label: string;
  color: "blue" | "emerald" | "purple" | "sky" | "amber" | "red";
  detail: string;
}

export async function getGuestTags(guestId: number): Promise<GuestTag[]> {
  const tags: GuestTag[] = [];

  const [guest, completedCount, lastVisit, noShowCount, reservationIds] = await Promise.all([
    prisma.guest.findUnique({
      where: { id: guestId },
      select: { totalVisits: true, lastVisitDate: true },
    }),
    prisma.reservation.count({ where: { guestId, status: "completed" } }),
    prisma.reservation.findFirst({
      where: { guestId, status: "completed" },
      orderBy: { date: "desc" },
      select: { date: true },
    }),
    prisma.reservation.count({ where: { guestId, status: "no_show" } }),
    prisma.reservation.findMany({
      where: { guestId },
      select: { id: true },
    }),
  ]);

  const totalPaid = reservationIds.length > 0
    ? await prisma.reservationPayment.aggregate({
      where: { reservationId: { in: reservationIds.map((row) => row.id) } },
      _sum: { amount: true },
    })
    : { _sum: { amount: 0 } };

  const visitCount = Math.max(completedCount, guest?.totalVisits || 0);
  const lastVisitDate = lastVisit?.date || guest?.lastVisitDate || null;

  if (completedCount === 0 && visitCount === 0) {
    tags.push({ label: "First Time", color: "blue", detail: "No previous visits" });
  } else if (visitCount >= 10 || Number(totalPaid._sum.amount || 0) >= 250000) {
    tags.push({ label: "VIP", color: "purple", detail: `${visitCount} visits` });
  } else if (visitCount >= 3) {
    tags.push({ label: "Regular", color: "emerald", detail: `${visitCount} visits` });
  } else {
    tags.push({ label: "Returning", color: "sky", detail: `${visitCount} visit${visitCount > 1 ? "s" : ""}` });
  }

  if (lastVisitDate && visitCount >= 2) {
    const daysSince = (Date.now() - new Date(`${lastVisitDate}T12:00:00`).getTime()) / (1000 * 60 * 60 * 24);
    if (Number.isFinite(daysSince) && daysSince > 90) {
      tags.push({ label: "Win Back", color: "amber", detail: `Last visit ${Math.round(daysSince)} days ago` });
    }
  }

  if (noShowCount >= 2) {
    const totalOutcomes = completedCount + noShowCount;
    if (totalOutcomes >= 3) {
      const noShowRate = noShowCount / totalOutcomes;
      if (noShowRate >= 0.15) {
        tags.push({
          label: "No-Show Risk",
          color: noShowCount >= 3 ? "red" : "amber",
          detail: `${noShowCount} no-shows (${Math.round(noShowRate * 100)}% rate)`,
        });
      }
    }
  }

  return tags;
}
