import { NextRequest, NextResponse } from "next/server";
import { badRequest, forbidden, unauthorized } from "@/lib/api";
import { requireSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  cancelPendingSequenceEvents,
  getTemplateContent,
  sendDirectEmail,
  sendSequenceEvent,
  type PurchaseInfo,
  type SequenceTemplateId,
} from "@/lib/email-sequences";
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

  const body = (await request.json()) as {
    action?: string;
    eventId?: string;
    template?: string;
    to?: string;
    subject?: string;
    body?: string;
  };

  const template = String(body.template || "").trim();
  if (template) {
    const recipient = String(body.to || restaurant.ownerEmail || restaurant.adminEmail || "")
      .trim()
      .toLowerCase();
    if (!recipient) return badRequest("Recipient email is required");

    const now = new Date();

    if (template === "custom") {
      const subject = String(body.subject || "").trim();
      const emailBody = String(body.body || "").trim();
      if (!subject) return badRequest("Subject is required");
      if (!emailBody) return badRequest("Body is required");

      await sendDirectEmail({
        to: recipient,
        subject,
        body: emailBody,
      });

      const event = await prisma.emailSequenceEvent.create({
        data: {
          restaurantId: restaurant.id,
          trigger: "manual",
          sequenceStep: 99,
          scheduledAt: now,
          sentAt: now,
          emailTo: recipient,
          emailSubject: subject,
          emailBody,
          status: "sent",
        },
      });

      return NextResponse.json({ success: true, id: event.id, event });
    }

    if (template !== "welcome" && template !== "setup_checkin" && template !== "tips") {
      return badRequest("Invalid template");
    }

    const info: PurchaseInfo = {
      restaurantId: restaurant.id,
      ownerName: restaurant.ownerName || recipient.split("@")[0] || "Owner",
      ownerEmail: recipient,
      restaurantName: restaurant.name,
      plan: restaurant.plan,
      licenseKey: restaurant.licenseKey,
      instanceUrl: restaurant.hosted
        ? `https://${restaurant.domain || `${restaurant.slug}.reservesit.com`}`
        : "self-hosted",
      hosted: restaurant.hosted,
    };

    const content = getTemplateContent(template as SequenceTemplateId, info);

    await sendDirectEmail({
      to: recipient,
      subject: content.subject,
      body: content.body,
    });

    const event = await prisma.emailSequenceEvent.create({
      data: {
        restaurantId: restaurant.id,
        trigger: "manual_template",
        sequenceStep: content.step,
        scheduledAt: now,
        sentAt: now,
        emailTo: recipient,
        emailSubject: content.subject,
        emailBody: content.body,
        status: "sent",
      },
    });

    return NextResponse.json({ success: true, id: event.id, event });
  }

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
