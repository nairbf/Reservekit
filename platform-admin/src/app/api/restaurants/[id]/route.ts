import { NextRequest, NextResponse } from "next/server";
import { LicenseEventType, RestaurantPlan, RestaurantStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { isAdminOrSuper, isSupport } from "@/lib/rbac";
import { badRequest, forbidden, unauthorized } from "@/lib/api";

function parsePlan(value: unknown): RestaurantPlan | null {
  const v = String(value || "");
  if (v === "CORE" || v === "SERVICE_PRO" || v === "FULL_SUITE") return v;
  return null;
}

function parseStatus(value: unknown): RestaurantStatus | null {
  const v = String(value || "");
  if (v === "ACTIVE" || v === "SUSPENDED" || v === "TRIAL" || v === "CANCELLED") return v;
  return null;
}

function eventFromStatusChange(previous: RestaurantStatus, next: RestaurantStatus): LicenseEventType | null {
  if (previous === next) return null;
  if (next === "SUSPENDED") return LicenseEventType.SUSPENDED;
  if (next === "CANCELLED") return LicenseEventType.CANCELLED;
  if (next === "ACTIVE" && previous !== "ACTIVE") return LicenseEventType.REACTIVATED;
  return null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
  } catch {
    return unauthorized();
  }

  const { id } = await params;
  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    include: {
      healthChecks: {
        orderBy: { checkedAt: "desc" },
        take: 50,
      },
      licenseEvents: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(restaurant);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession().catch(() => null);
  if (!session) return unauthorized();

  const { id } = await params;
  const current = await prisma.restaurant.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  if (isSupport(session.role)) {
    const notes = body?.notes !== undefined ? String(body.notes || "") : current.notes;
    const updated = await prisma.restaurant.update({
      where: { id },
      data: { notes },
    });
    return NextResponse.json(updated);
  }

  if (!isAdminOrSuper(session.role)) return forbidden();

  const nextPlan = body?.plan !== undefined ? parsePlan(body.plan) : null;
  const nextStatus = body?.status !== undefined ? parseStatus(body.status) : null;

  if (body?.plan !== undefined && !nextPlan) return badRequest("Invalid plan");
  if (body?.status !== undefined && !nextStatus) return badRequest("Invalid status");

  let trialEndsAtValue: Date | null | undefined = undefined;
  if (nextStatus) {
    if (nextStatus === "TRIAL") {
      trialEndsAtValue = current.trialEndsAt || new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
    } else {
      trialEndsAtValue = null;
    }
  }

  const updated = await prisma.restaurant.update({
    where: { id },
    data: {
      name: body?.name !== undefined ? String(body.name || "").trim() : undefined,
      adminEmail: body?.adminEmail !== undefined ? String(body.adminEmail || "").trim().toLowerCase() : undefined,
      plan: nextPlan || undefined,
      status: nextStatus || undefined,
      notes: body?.notes !== undefined ? String(body.notes || "") : undefined,
      monthlyHostingActive:
        body?.monthlyHostingActive !== undefined
          ? Boolean(body.monthlyHostingActive)
          : undefined,
      trialEndsAt: trialEndsAtValue,
    },
  });

  if (nextStatus) {
    const event = eventFromStatusChange(current.status, nextStatus);
    if (event) {
      await prisma.licenseEvent.create({
        data: {
          restaurantId: id,
          event,
          details: `Status changed from ${current.status} to ${nextStatus}`,
          performedBy: session.email,
        },
      });
    }
  }

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession().catch(() => null);
  if (!session) return unauthorized();
  if (!isAdminOrSuper(session.role)) return forbidden();

  const { id } = await params;

  const existing = await prisma.restaurant.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.restaurant.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
