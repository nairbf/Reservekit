import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { sendSms } from "@/lib/sms";
import { getSettings, getDiningDuration } from "@/lib/settings";
import { generateCode } from "@/lib/codes";
import { minutesToTime, timeToMinutes } from "@/lib/availability";
import { reorderActiveWaitlistPositions } from "@/lib/waitlist";
import { sendNotification } from "@/lib/send-notification";

function currentDateTime() {
  const now = new Date();
  const date = now.toISOString().split("T")[0];
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return { now, date, time };
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const entryId = Number(id);
  if (!Number.isFinite(entryId) || entryId <= 0) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json();
  const action = String(body?.action || "").toLowerCase();
  const entry = await prisma.waitlistEntry.findUnique({ where: { id: Math.trunc(entryId) } });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date();
  const restaurantName = (await prisma.setting.findUnique({ where: { key: "restaurantName" } }))?.value || "Restaurant";

  if (action === "notify") {
    const updated = await prisma.waitlistEntry.update({
      where: { id: entry.id },
      data: { status: "notified", notifiedAt: now, updatedAt: now },
    });
    await sendSms({
      to: updated.guestPhone,
      body: `${restaurantName}: Hi ${updated.guestName}! Your table is almost ready. Please head to the host stand. Reply CANCEL to leave the waitlist.`,
      messageType: "waitlist_notify",
    });
    if (updated.guestEmail) {
      await sendNotification({
        templateId: "waitlist_ready",
        to: updated.guestEmail,
        messageType: "waitlist_ready",
        variables: {
          guestName: updated.guestName,
          partySize: String(updated.partySize),
        },
      });
    }
    return NextResponse.json(updated);
  }

  if (action === "seat") {
    const updated = await prisma.waitlistEntry.update({
      where: { id: entry.id },
      data: { status: "seated", seatedAt: now, updatedAt: now },
    });
    let reservation = null;
    if (body?.createReservation !== false) {
      const settings = await getSettings();
      const partySize = Math.max(1, entry.partySize);
      const duration = getDiningDuration(settings.diningDurations, partySize);
      const { now: nowDt, date, time } = currentDateTime();
      let code = generateCode();
      while (await prisma.reservation.findUnique({ where: { code } })) code = generateCode();
      reservation = await prisma.reservation.create({
        data: {
          code,
          guestName: entry.guestName,
          guestPhone: entry.guestPhone,
          guestEmail: entry.guestEmail || null,
          partySize,
          date,
          time,
          endTime: minutesToTime(timeToMinutes(time) + duration),
          durationMin: duration,
          source: "waitlist",
          status: "seated",
          tableId: body?.tableId ? Number(body.tableId) : null,
          seatedAt: nowDt,
          guestId: entry.guestId || null,
        },
        include: { table: true },
      });
    }
    await reorderActiveWaitlistPositions();
    return NextResponse.json({ entry: updated, reservation });
  }

  if (action === "cancel") {
    const updated = await prisma.waitlistEntry.update({
      where: { id: entry.id },
      data: { status: "cancelled", updatedAt: now },
    });
    await reorderActiveWaitlistPositions();
    return NextResponse.json(updated);
  }

  if (action === "remove") {
    const updated = await prisma.waitlistEntry.update({
      where: { id: entry.id },
      data: { status: "left", updatedAt: now },
    });
    await reorderActiveWaitlistPositions();
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const entryId = Number(id);
  if (!Number.isFinite(entryId) || entryId <= 0) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  await prisma.waitlistEntry.delete({ where: { id: Math.trunc(entryId) } });
  await reorderActiveWaitlistPositions();
  return NextResponse.json({ ok: true });
}
