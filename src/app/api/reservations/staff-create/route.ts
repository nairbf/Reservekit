import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getSettings, getDiningDuration } from "@/lib/settings";
import { generateCode } from "@/lib/codes";
import { timeToMinutes, minutesToTime } from "@/lib/availability";
import { linkGuestToReservation } from "@/lib/guest";
import { isValidEmail, isValidPhone, sanitizeHtml, sanitizeString } from "@/lib/validate";
import { getCurrentTimeInTimezone, getRestaurantTimezone, getTodayInTimezone } from "@/lib/timezone";

export async function POST(req: NextRequest) {
  let session;
  try { session = await requirePermission("manage_reservations"); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  const body = await req.json();
  const guestName = sanitizeString(body?.guestName, 120);
  const guestPhone = sanitizeString(body?.guestPhone, 32);
  const guestEmailRaw = sanitizeString(body?.guestEmail, 254).toLowerCase();
  const guestEmail = guestEmailRaw || null;
  const partySize = Math.trunc(Number(body?.partySize || 0));
  const date = sanitizeString(body?.date, 32);
  const time = sanitizeString(body?.time, 16);
  const tableId = body?.tableId;
  const source = sanitizeString(body?.source, 32).toLowerCase();
  const notes = sanitizeHtml(sanitizeString(body?.notes, 500));
  if (!guestName || !partySize || !source) return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  if (guestPhone && !isValidPhone(guestPhone)) return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  if (guestEmail && !isValidEmail(guestEmail)) return NextResponse.json({ error: "Invalid email address" }, { status: 400 });

  const settings = await getSettings();
  const duration = getDiningDuration(settings.diningDurations, partySize);
  const isWalkin = source === "walkin";
  const now = new Date();
  const timezone = await getRestaurantTimezone();
  const resDate = isWalkin ? getTodayInTimezone(timezone) : date;
  const resTime = isWalkin ? getCurrentTimeInTimezone(timezone) : time;

  let code = generateCode();
  while (await prisma.reservation.findUnique({ where: { code } })) code = generateCode();

  const reservation = await prisma.reservation.create({
    data: {
      code,
      guestName,
      guestPhone: guestPhone || "",
      guestEmail,
      partySize,
      date: resDate,
      time: resTime,
      endTime: minutesToTime(timeToMinutes(resTime) + duration),
      durationMin: duration,
      specialRequests: notes || null,
      source,
      status: isWalkin ? "seated" : "approved",
      tableId: tableId || null,
      createdById: session.userId,
      approvedAt: now,
      seatedAt: isWalkin ? now : null,
    },
    include: { table: true },
  });
  linkGuestToReservation(reservation.id).catch(console.error);
  return NextResponse.json(reservation, { status: 201 });
}
