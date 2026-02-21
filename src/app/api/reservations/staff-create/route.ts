import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getSettings, getDiningDuration } from "@/lib/settings";
import { generateCode } from "@/lib/codes";
import { getAvailableSlots, timeToMinutes, minutesToTime } from "@/lib/availability";
import { linkGuestToReservation } from "@/lib/guest";
import { isValidEmail, isValidPhone, sanitizeHtml, sanitizeString } from "@/lib/validate";
import { getCurrentTimeInTimezone, getRestaurantTimezone, getTodayInTimezone } from "@/lib/timezone";
import { getAppUrlFromRequest } from "@/lib/app-url";
import { notifyApproved } from "@/lib/notifications";

function parsePositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.trunc(parsed);
  if (rounded <= 0) return null;
  return rounded;
}

export async function POST(req: NextRequest) {
  let session;
  try { session = await requirePermission("manage_reservations"); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  const appUrl = getAppUrlFromRequest(req);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const guestName = sanitizeString(body.guestName, 120);
  const guestPhone = sanitizeString(body.guestPhone, 32);
  const guestEmailRaw = sanitizeString(body.guestEmail, 254).toLowerCase();
  const guestEmail = guestEmailRaw || null;
  const partySize = parsePositiveInt(body.partySize);
  const dateInput = sanitizeString(body.date, 32);
  const timeInput = sanitizeString(body.time, 16);
  const durationInput = parsePositiveInt(body.durationMin);
  const rawSource = sanitizeString(body.source, 32).toLowerCase();
  const source = rawSource || "staff";
  const specialRequests = sanitizeHtml(sanitizeString(body.specialRequests ?? body.notes, 500));
  const autoApprove = body.autoApprove !== false;

  if (!guestName || !guestPhone || !partySize) {
    return NextResponse.json({ error: "guestName, guestPhone, and partySize are required" }, { status: 400 });
  }
  if (!isValidPhone(guestPhone)) return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  if (guestEmail && !isValidEmail(guestEmail)) return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  if (!["staff", "phone", "walkin", "widget"].includes(source)) {
    return NextResponse.json({ error: "Invalid source" }, { status: 400 });
  }

  const settings = await getSettings();
  if (partySize > settings.maxPartySize) {
    return NextResponse.json({ error: `Party size must be 1-${settings.maxPartySize}` }, { status: 400 });
  }
  const duration = durationInput || getDiningDuration(settings.diningDurations, partySize);
  const isWalkin = source === "walkin";
  const now = new Date();
  const timezone = await getRestaurantTimezone();
  const resDate = isWalkin ? getTodayInTimezone(timezone) : dateInput;
  if (!resDate) return NextResponse.json({ error: "date is required" }, { status: 400 });

  const rawTime = isWalkin ? getCurrentTimeInTimezone(timezone) : timeInput;
  const requestedMinutes = timeToMinutes(rawTime);
  if (!Number.isFinite(requestedMinutes) || requestedMinutes < 0) {
    return NextResponse.json({ error: "Invalid time" }, { status: 400 });
  }
  const resTime = minutesToTime(requestedMinutes);
  const endTime = minutesToTime(requestedMinutes + duration);

  const tableIdInput = body.tableId;
  let tableId: number | null = null;
  if (!(tableIdInput === null || tableIdInput === "" || tableIdInput === undefined)) {
    const parsedTableId = parsePositiveInt(tableIdInput);
    if (!parsedTableId) return NextResponse.json({ error: "Invalid tableId" }, { status: 400 });
    const table = await prisma.restaurantTable.findUnique({
      where: { id: parsedTableId },
      select: { id: true, maxCapacity: true, isActive: true },
    });
    if (!table || !table.isActive) return NextResponse.json({ error: "Table not found" }, { status: 404 });
    if (table.maxCapacity < partySize) {
      return NextResponse.json({ error: `Table capacity is ${table.maxCapacity} for party size ${partySize}` }, { status: 400 });
    }
    tableId = table.id;
  }

  if (!isWalkin || tableId === null) {
    const availability = await getAvailableSlots(resDate, partySize);
    const requestedSlot = availability.find((slot) => slot.time === resTime);
    if (!requestedSlot || !requestedSlot.available) {
      return NextResponse.json({ error: "No availability for the requested time" }, { status: 409 });
    }
  }

  let code = generateCode();
  while (await prisma.reservation.findUnique({ where: { code } })) code = generateCode();

  const status = isWalkin ? "seated" : (autoApprove ? "confirmed" : "pending");
  const reservation = await prisma.reservation.create({
    data: {
      code,
      guestName,
      guestPhone,
      guestEmail,
      partySize,
      date: resDate,
      time: resTime,
      endTime,
      durationMin: duration,
      specialRequests: specialRequests || null,
      source,
      status,
      tableId,
      createdById: session.userId,
      approvedAt: autoApprove || isWalkin ? now : null,
      arrivedAt: isWalkin ? now : null,
      seatedAt: isWalkin ? now : null,
    },
    include: { table: true, guest: true, payment: true, preOrder: true },
  });
  await linkGuestToReservation(reservation.id).catch(console.error);

  if (guestEmail && (status === "confirmed" || status === "seated")) {
    notifyApproved(reservation, appUrl).catch(console.error);
  }

  return NextResponse.json(reservation, { status: 201 });
}
