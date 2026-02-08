import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSettings, getDiningDuration } from "@/lib/settings";
import { generateCode } from "@/lib/codes";
import { timeToMinutes, minutesToTime } from "@/lib/availability";
import { notifyRequestReceived } from "@/lib/notifications";
import { linkGuestToReservation } from "@/lib/guest";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { guestName, guestPhone, guestEmail, partySize, date, time, specialRequests } = body;
  if (!guestName || !guestPhone || !partySize || !date || !time) return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

  const settings = await getSettings();
  if (partySize < 1 || partySize > settings.maxPartySize) return NextResponse.json({ error: `Party size must be 1-${settings.maxPartySize}` }, { status: 400 });

  const dupe = await prisma.reservation.findFirst({ where: { guestPhone, date, time, status: { notIn: ["cancelled", "declined", "expired"] } } });
  if (dupe) return NextResponse.json({ error: "You already have a request for this time" }, { status: 409 });

  const duration = getDiningDuration(settings.diningDurations, partySize);
  const endTime = minutesToTime(timeToMinutes(time) + duration);
  let code = generateCode();
  while (await prisma.reservation.findUnique({ where: { code } })) code = generateCode();

  const reservation = await prisma.reservation.create({ data: { code, guestName, guestPhone, guestEmail: guestEmail || null, partySize, date, time, endTime, durationMin: duration, specialRequests: specialRequests || null, source: "widget", status: "pending" } });
  linkGuestToReservation(reservation.id).catch(console.error);
  notifyRequestReceived(reservation).catch(console.error);
  return NextResponse.json({ id: reservation.id, code: reservation.code, status: "pending", message: "Your reservation request has been received." }, { status: 201 });
}
