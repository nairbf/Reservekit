import { NextRequest, NextResponse } from "next/server";
import { badRequest, forbidden, unauthorized } from "@/lib/api";
import { requireSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cancelPendingSequenceEvents, sendSequenceEvent } from "@/lib/email-sequences";
import { isAdminOrSuper } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSessionFromRequest(request);
  } catch {
    return unauthorized();
  }

  const { id } = await params;
  const restaurant = await prisma.restaurant.findUnique({ where: { id } });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const events = await prisma.emailSequenceEvent.findMany({
    where: { restaurantId: id },
    orderBy: [{ sequenceStep: "asc" }, { scheduledAt: "asc" }],
  });

  return NextResponse.json({ events });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = (() => {
    try {
      return requireSessionFromRequest(request);
    } catch {
      return null;
    }
  })();
  if (!session) return unauthorized();
  if (!isAdminOrSuper(session.role)) return forbidden();

  const { id } = await params;
  const restaurant = await prisma.restaurant.findUnique({ where: { id } });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await request.json()) as { action?: string; eventId?: string };
  const action = String(body.action || "");

  if (action === "cancelPending") {
    const cancelled = await cancelPendingSequenceEvents(id);
    return NextResponse.json({ cancelled });
  }

  if (action === "resendFailed") {
    const eventId = String(body.eventId || "").trim();
    if (!eventId) return badRequest("eventId is required");

    const event = await prisma.emailSequenceEvent.findFirst({
      where: { id: eventId, restaurantId: id },
    });
    if (!event) return NextResponse.json({ error: "Sequence event not found" }, { status: 404 });
    if (event.status !== "failed") return badRequest("Only failed emails can be resent");

    await prisma.emailSequenceEvent.update({
      where: { id: eventId },
      data: {
        status: "pending",
        scheduledAt: new Date(),
      },
    });

    try {
      await sendSequenceEvent(eventId);
      const refreshed = await prisma.emailSequenceEvent.findUnique({ where: { id: eventId } });
      return NextResponse.json({ event: refreshed });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to resend email" },
        { status: 500 },
      );
    }
  }

  return badRequest("Unsupported action");
}
