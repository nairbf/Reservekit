import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { estimateWaitMinutes, getTodaysWaitlist, reorderActiveWaitlistPositions } from "@/lib/waitlist";
import { sendNotification } from "@/lib/send-notification";

function normalizePhone(value: string): string {
  return String(value || "").replace(/[^\d+]/g, "").trim();
}

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;
  const rows = await getTodaysWaitlist(status);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const guestName = String(body?.guestName || "").trim();
  const guestPhone = normalizePhone(body?.guestPhone || "");
  const guestEmail = String(body?.guestEmail || "").trim() || null;
  const notes = String(body?.notes || "").trim() || null;
  const partySize = Math.max(1, parseInt(String(body?.partySize || "1"), 10) || 1);

  if (!guestName || !guestPhone || !partySize) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const todays = await getTodaysWaitlist();
  const active = todays.filter(r => ["waiting", "notified"].includes(r.status));
  const duplicate = active.find(r => normalizePhone(r.guestPhone) === guestPhone);
  if (duplicate) {
    return NextResponse.json({ error: "This phone number is already on the waitlist.", entry: duplicate }, { status: 409 });
  }

  const nextPosition = active.length ? Math.max(...active.map(r => r.position)) + 1 : 1;
  const estimate = await estimateWaitMinutes(partySize, active.map(r => ({ partySize: r.partySize, status: r.status })));

  const guest = await prisma.guest.findFirst({
    where: {
      OR: [
        { phone: guestPhone },
        { phone: body?.guestPhone || "" },
      ],
    },
  });

  const created = await prisma.waitlistEntry.create({
    data: {
      guestName,
      guestPhone,
      guestEmail,
      partySize,
      estimatedWait: estimate.estimatedMinutes,
      status: "waiting",
      position: nextPosition,
      notes,
      guestId: guest?.id || null,
    },
  });

  await reorderActiveWaitlistPositions();

  if (created.guestEmail) {
    sendNotification({
      templateId: "waitlist_added",
      to: created.guestEmail,
      messageType: "waitlist_added",
      variables: {
        guestName: created.guestName,
        partySize: String(created.partySize),
        estimatedWait: `${estimate.estimatedMinutes} minutes`,
        position: String(created.position),
      },
    }).catch(console.error);
  }

  return NextResponse.json({
    ...created,
    estimatedMinutes: estimate.estimatedMinutes,
    partiesAhead: estimate.partiesAhead,
  }, { status: 201 });
}
