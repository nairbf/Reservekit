import { prisma } from "@/lib/db";

export interface GuestTag {
  label: string;
  color: "blue" | "emerald" | "purple" | "sky" | "amber" | "red";
  detail: string;
}

export async function getGuestTags(guestId: number): Promise<GuestTag[]> {
  const tags: GuestTag[] = [];

  const [completedCount, lastVisit, noShowCount, reservationIds] = await Promise.all([
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

  if (completedCount === 0) {
    tags.push({ label: "First Time", color: "blue", detail: "No previous visits" });
  } else if (completedCount >= 10 || Number(totalPaid._sum.amount || 0) >= 250000) {
    tags.push({ label: "VIP", color: "purple", detail: `${completedCount} visits` });
  } else if (completedCount >= 3) {
    tags.push({ label: "Regular", color: "emerald", detail: `${completedCount} visits` });
  } else {
    tags.push({ label: "Returning", color: "sky", detail: `${completedCount} visit${completedCount > 1 ? "s" : ""}` });
  }

  if (lastVisit && completedCount >= 2) {
    const daysSince = (Date.now() - new Date(`${lastVisit.date}T12:00:00`).getTime()) / (1000 * 60 * 60 * 24);
    if (Number.isFinite(daysSince) && daysSince > 90) {
      tags.push({ label: "Win Back", color: "amber", detail: `Last visit ${Math.round(daysSince)} days ago` });
    }
  }

  if (noShowCount > 0) {
    tags.push({ label: "No-Show History", color: "red", detail: `${noShowCount} no-show${noShowCount > 1 ? "s" : ""}` });
  }

  return tags;
}
