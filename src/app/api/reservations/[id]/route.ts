import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getAvailableSlots, minutesToTime, timeToMinutes } from "@/lib/availability";
import { getDiningDuration, getSettings } from "@/lib/settings";
import { linkGuestToReservation } from "@/lib/guest";
import { isValidEmail, isValidPhone, sanitizeHtml, sanitizeString } from "@/lib/validate";

function parsePositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.trunc(parsed);
  if (rounded <= 0) return null;
  return rounded;
}

function normalizeTime(value: string): string | null {
  const minutes = timeToMinutes(value);
  if (!Number.isFinite(minutes) || minutes < 0) return null;
  return minutesToTime(minutes);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("manage_reservations");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const reservationId = Number(id);
  if (!Number.isFinite(reservationId) || reservationId <= 0) {
    return NextResponse.json({ error: "Invalid reservation id" }, { status: 400 });
  }

  const reservation = await prisma.reservation.findUnique({ where: { id: Math.trunc(reservationId) } });
  if (!reservation) return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  if (["completed", "cancelled"].includes(reservation.status)) {
    return NextResponse.json({ error: "Completed or cancelled reservations cannot be edited" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const settings = await getSettings();

  const hasPartySize = Object.prototype.hasOwnProperty.call(body, "partySize");
  const hasDate = Object.prototype.hasOwnProperty.call(body, "date");
  const hasTime = Object.prototype.hasOwnProperty.call(body, "time");
  const hasDuration = Object.prototype.hasOwnProperty.call(body, "durationMin");
  const hasEndTime = Object.prototype.hasOwnProperty.call(body, "endTime");

  let nextPartySize = reservation.partySize;
  if (hasPartySize) {
    const parsedParty = parsePositiveInt(body.partySize);
    if (!parsedParty) return NextResponse.json({ error: "Invalid party size" }, { status: 400 });
    if (parsedParty > settings.maxPartySize) {
      return NextResponse.json({ error: `Party size must be 1-${settings.maxPartySize}` }, { status: 400 });
    }
    nextPartySize = parsedParty;
  }

  let nextDate = reservation.date;
  if (hasDate) {
    const parsedDate = sanitizeString(body.date, 32);
    if (!parsedDate) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    nextDate = parsedDate;
  }

  let nextTime = reservation.time;
  if (hasTime) {
    const parsedTime = normalizeTime(sanitizeString(body.time, 16));
    if (!parsedTime) return NextResponse.json({ error: "Invalid time" }, { status: 400 });
    nextTime = parsedTime;
  } else {
    const normalizedCurrentTime = normalizeTime(reservation.time);
    if (normalizedCurrentTime) nextTime = normalizedCurrentTime;
  }

  let nextDuration = reservation.durationMin;
  if (hasDuration) {
    const parsedDuration = parsePositiveInt(body.durationMin);
    if (!parsedDuration) return NextResponse.json({ error: "Invalid duration" }, { status: 400 });
    nextDuration = parsedDuration;
  } else if (hasPartySize) {
    nextDuration = getDiningDuration(settings.diningDurations, nextPartySize);
  }

  const nextTimeMinutes = timeToMinutes(nextTime);
  if (!Number.isFinite(nextTimeMinutes) || nextTimeMinutes < 0) {
    return NextResponse.json({ error: "Invalid time" }, { status: 400 });
  }

  let nextEndTime = reservation.endTime;
  if (hasTime || hasDuration || hasPartySize) {
    nextEndTime = minutesToTime(nextTimeMinutes + nextDuration);
  } else if (hasEndTime) {
    const parsedEndTime = normalizeTime(sanitizeString(body.endTime, 16));
    if (!parsedEndTime) return NextResponse.json({ error: "Invalid end time" }, { status: 400 });
    nextEndTime = parsedEndTime;
  }

  if (hasPartySize || hasDate || hasTime) {
    const slots = await getAvailableSlots(nextDate, nextPartySize, { excludeReservationId: reservation.id });
    const requestedSlot = slots.find((slot) => slot.time === nextTime);
    if (!requestedSlot || !requestedSlot.available) {
      return NextResponse.json({ error: "No availability for the requested time" }, { status: 409 });
    }
  }

  const data: Record<string, unknown> = {
    partySize: nextPartySize,
    date: nextDate,
    time: nextTime,
    durationMin: nextDuration,
    endTime: nextEndTime,
  };

  if (Object.prototype.hasOwnProperty.call(body, "specialRequests")) {
    const specialRequests = sanitizeHtml(sanitizeString(body.specialRequests, 500));
    data.specialRequests = specialRequests || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "guestName")) {
    const guestName = sanitizeString(body.guestName, 120);
    if (!guestName) return NextResponse.json({ error: "Guest name is required" }, { status: 400 });
    data.guestName = guestName;
  }

  if (Object.prototype.hasOwnProperty.call(body, "guestPhone")) {
    const guestPhone = sanitizeString(body.guestPhone, 32);
    if (guestPhone && !isValidPhone(guestPhone)) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }
    data.guestPhone = guestPhone || reservation.guestPhone;
  }

  if (Object.prototype.hasOwnProperty.call(body, "guestEmail")) {
    const guestEmail = sanitizeString(body.guestEmail, 254).toLowerCase();
    if (guestEmail && !isValidEmail(guestEmail)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }
    data.guestEmail = guestEmail || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "tableId")) {
    const rawTableId = body.tableId;
    if (rawTableId === null || rawTableId === "" || rawTableId === undefined) {
      data.tableId = null;
    } else {
      const parsedTableId = parsePositiveInt(rawTableId);
      if (!parsedTableId) return NextResponse.json({ error: "Invalid table id" }, { status: 400 });
      const table = await prisma.restaurantTable.findUnique({ where: { id: parsedTableId }, select: { id: true } });
      if (!table) return NextResponse.json({ error: "Table not found" }, { status: 404 });
      data.tableId = parsedTableId;
    }
  }

  let updated: any;
  try {
    updated = await prisma.reservation.update({
      where: { id: reservation.id },
      data,
      include: {
        table: true,
        guest: true,
        payment: true,
        preOrder: {
          include: {
            items: {
              include: { menuItem: { include: { category: true } } },
              orderBy: [{ guestLabel: "asc" }, { id: "asc" }],
            },
          },
        },
      },
    });
  } catch (error) {
    const prismaError = error as { code?: string; message?: string };
    if (!(prismaError.code === "P2021" && String(prismaError.message || "").includes("PreOrder"))) {
      throw error;
    }
    updated = await prisma.reservation.update({
      where: { id: reservation.id },
      data,
      include: { table: true, guest: true, payment: true },
    });
    updated = { ...updated, preOrder: null };
  }

  linkGuestToReservation(updated.id).catch(console.error);
  return NextResponse.json(updated);
}
