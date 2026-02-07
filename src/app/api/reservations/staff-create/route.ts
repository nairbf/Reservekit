import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getSettings, getDiningDuration } from "@/lib/settings";
import { generateCode } from "@/lib/codes";
import { timeToMinutes, minutesToTime } from "@/lib/availability";

export async function POST(req: NextRequest) {
  let session;
  try { session = await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const body = await req.json();
  const { guestName, guestPhone, partySize, date, time, tableId, source } = body;
  if (!guestName || !partySize || !source) return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

  const settings = await getSettings();
  const duration = getDiningDuration(settings.diningDurations, partySize);
  const isWalkin = source === "walkin";
  const now = new Date();
  const resDate = isWalkin ? now.toISOString().split("T")[0] : date;
  const resTime = isWalkin ? `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}` : time;

  let code = generateCode();
  while (await prisma.reservation.findUnique({ where: { code } })) code = generateCode();

  const reservation = await prisma.reservation.create({
    data: { code, guestName, guestPhone: guestPhone || "", partySize, date: resDate, time: resTime, endTime: minutesToTime(timeToMinutes(resTime) + duration), durationMin: duration, source, status: isWalkin ? "seated" : "approved", tableId: tableId || null, createdById: session.userId, approvedAt: now, seatedAt: isWalkin ? now : null },
    include: { table: true },
  });
  return NextResponse.json(reservation, { status: 201 });
}
