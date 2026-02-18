import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSettings, getDiningDuration, getEffectiveDepositForRequest } from "@/lib/settings";
import { generateCode } from "@/lib/codes";
import { timeToMinutes, minutesToTime } from "@/lib/availability";
import { notifyRequestReceived } from "@/lib/notifications";
import { linkGuestToReservation } from "@/lib/guest";
import { saveLoyaltyConsent } from "@/lib/loyalty";
import { notifyStaffLargeParty, notifyStaffNewRequest } from "@/lib/staff-notifications";
import { checkReservationRate, getClientIp, tooManyRequests } from "@/lib/rate-limit";
import { isValidEmail, isValidPhone, sanitizeHtml, sanitizeString } from "@/lib/validate";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = checkReservationRate(ip);
  if (!limit.allowed) return tooManyRequests(limit.resetAt);

  const body = await req.json();
  const guestName = sanitizeString(body?.guestName, 120);
  const guestPhone = sanitizeString(body?.guestPhone, 32);
  const guestEmailRaw = sanitizeString(body?.guestEmail, 254).toLowerCase();
  const guestEmail = guestEmailRaw || null;
  const partySize = Math.trunc(Number(body?.partySize || 0));
  const date = sanitizeString(body?.date, 32);
  const time = sanitizeString(body?.time, 16);
  const specialRequests = sanitizeHtml(sanitizeString(body?.specialRequests, 500));
  const loyaltyOptIn = body?.loyaltyOptIn;
  if (!guestName || !guestPhone || !partySize || !date || !time) return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  if (!isValidPhone(guestPhone)) return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  if (guestEmail && !isValidEmail(guestEmail)) return NextResponse.json({ error: "Invalid email address" }, { status: 400 });

  const settings = await getSettings();
  if (partySize < 1 || partySize > settings.maxPartySize) return NextResponse.json({ error: `Party size must be 1-${settings.maxPartySize}` }, { status: 400 });

  const dupe = await prisma.reservation.findFirst({ where: { guestPhone, date, time, status: { notIn: ["cancelled", "declined", "expired"] } } });
  if (dupe) return NextResponse.json({ error: "You already have a request for this time" }, { status: 409 });

  const duration = getDiningDuration(settings.diningDurations, partySize);
  const endTime = minutesToTime(timeToMinutes(time) + duration);
  const deposit = getEffectiveDepositForRequest(settings, date, partySize);
  let code = generateCode();
  while (await prisma.reservation.findUnique({ where: { code } })) code = generateCode();

  const reservation = await prisma.reservation.create({
    data: {
      code,
      guestName,
      guestPhone,
      guestEmail,
      partySize,
      date,
      time,
      endTime,
      durationMin: duration,
      specialRequests: specialRequests || null,
      source: "widget",
      status: "pending",
      requiresDeposit: deposit.required,
      depositAmount: deposit.required ? deposit.amount : null,
    },
  });
  if (typeof loyaltyOptIn === "boolean") {
    saveLoyaltyConsent(guestPhone, loyaltyOptIn, "reservation_request").catch(console.error);
  }
  linkGuestToReservation(reservation.id).catch(console.error);
  notifyRequestReceived(reservation).catch(console.error);
  notifyStaffNewRequest(reservation).catch(console.error);
  notifyStaffLargeParty(reservation).catch(console.error);
  return NextResponse.json({
    id: reservation.id,
    code: reservation.code,
    status: "pending",
    message: "Your reservation request has been received.",
    depositRequired: deposit.required,
    depositAmount: deposit.required ? deposit.amount : 0,
    depositMessage: deposit.required ? deposit.message : null,
  }, { status: 201 });
}
