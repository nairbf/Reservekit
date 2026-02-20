import { prisma } from "@/lib/db";

export interface NoShowRisk {
  score: number;
  level: "low" | "medium" | "high";
  reasons: string[];
}

export async function calculateNoShowRisk(reservationId: number): Promise<NoShowRisk> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      guestId: true,
      partySize: true,
      date: true,
      createdAt: true,
    },
  });

  if (!reservation) return { score: 0, level: "low", reasons: [] };

  let score = 10;
  const reasons: string[] = [];

  if (reservation.guestId) {
    const [pastNoShows, pastTotal, priorVisits] = await Promise.all([
      prisma.reservation.count({
        where: {
          guestId: reservation.guestId,
          status: "no_show",
        },
      }),
      prisma.reservation.count({
        where: {
          guestId: reservation.guestId,
          status: { in: ["completed", "no_show", "cancelled"] },
        },
      }),
      prisma.reservation.count({
        where: {
          guestId: reservation.guestId,
          status: "completed",
          id: { not: reservationId },
        },
      }),
    ]);

    if (pastNoShows > 0) {
      const noShowRate = pastTotal > 0 ? pastNoShows / pastTotal : 0;
      score += Math.round(noShowRate * 40);
      reasons.push(`${pastNoShows} previous no-show${pastNoShows > 1 ? "s" : ""}`);
    }

    if (priorVisits === 0) {
      score += 10;
      reasons.push("First-time guest");
    }
  } else {
    score += 10;
    reasons.push("No guest profile");
  }

  if (reservation.partySize >= 6) {
    score += 10;
    reasons.push("Large party (6+)");
  }

  const reservationDate = new Date(`${reservation.date}T12:00:00`);
  if (!Number.isNaN(reservationDate.getTime())) {
    const daysInAdvance = (reservationDate.getTime() - reservation.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysInAdvance > 14) {
      score += 10;
      reasons.push("Booked 14+ days in advance");
    }

    const dayOfWeek = reservationDate.getDay();
    if (dayOfWeek === 5 || dayOfWeek === 6) {
      score += 5;
      reasons.push("Weekend booking");
    }
  }

  score = Math.min(score, 100);
  const level: NoShowRisk["level"] = score >= 50 ? "high" : score >= 25 ? "medium" : "low";
  return { score, level, reasons };
}

export async function calculateTonightNoShowRisks(date: string): Promise<Map<number, NoShowRisk>> {
  const reservations = await prisma.reservation.findMany({
    where: { date, status: { in: ["confirmed", "pending", "approved", "arrived"] } },
    select: { id: true },
  });

  const risks = new Map<number, NoShowRisk>();
  for (const reservation of reservations) {
    risks.set(reservation.id, await calculateNoShowRisk(reservation.id));
  }
  return risks;
}
