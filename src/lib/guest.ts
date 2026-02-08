import { prisma } from "./db";

function normalizePhone(phone: string): string {
  const cleaned = phone.trim().replace(/[^\d+]/g, "");
  return cleaned || phone.trim();
}

export async function linkGuestToReservation(reservationId: number) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      guestId: true,
      guestName: true,
      guestPhone: true,
      guestEmail: true,
    },
  });

  if (!reservation) throw new Error(`Reservation ${reservationId} not found`);

  const phone = normalizePhone(reservation.guestPhone || "");
  if (!phone) throw new Error("Reservation has no guest phone");

  const existing = await prisma.guest.findUnique({ where: { phone } });

  if (existing) {
    const guest = await prisma.guest.update({
      where: { id: existing.id },
      data: {
        name: reservation.guestName || existing.name,
        email: reservation.guestEmail || existing.email,
      },
    });

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { guestId: guest.id, guestPhone: phone },
    });

    return guest;
  }

  const guest = await prisma.guest.create({
    data: {
      phone,
      name: reservation.guestName,
      email: reservation.guestEmail || null,
    },
  });

  await prisma.reservation.update({
    where: { id: reservation.id },
    data: { guestId: guest.id, guestPhone: phone },
  });

  return guest;
}

export async function updateGuestStats(guestId: number) {
  const reservations = await prisma.reservation.findMany({
    where: { guestId },
    select: { status: true, partySize: true, date: true },
  });

  const completed = reservations.filter(r => r.status === "completed");
  const totalVisits = completed.length;
  const totalNoShows = reservations.filter(r => r.status === "no_show").length;
  const totalCovers = completed.reduce((sum, r) => sum + r.partySize, 0);
  const dates = completed.map(r => r.date).sort();

  return prisma.guest.update({
    where: { id: guestId },
    data: {
      totalVisits,
      totalNoShows,
      totalCovers,
      firstVisitDate: dates[0] || null,
      lastVisitDate: dates.length ? dates[dates.length - 1] : null,
    },
  });
}
