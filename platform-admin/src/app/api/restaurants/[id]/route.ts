import { NextRequest, NextResponse } from "next/server";
import { LicenseEventType, RestaurantPlan, RestaurantStatus, HostingStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireSessionFromRequest } from "@/lib/auth";
import { isAdminOrSuper, isSupport } from "@/lib/rbac";
import { badRequest, forbidden, unauthorized } from "@/lib/api";
import { createLicenseEvent } from "@/lib/license-events";

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

function parseHostingStatus(value: unknown): HostingStatus | null {
  const v = String(value || "");
  if (v === "ACTIVE" || v === "SUSPENDED" || v === "SELF_HOSTED") return v;
  return null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSessionFromRequest(req);
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
  const session = (() => {
    try {
      return requireSessionFromRequest(req);
    } catch {
      return null;
    }
  })();
  if (!session) return unauthorized();

  const { id } = await params;
  const current = await prisma.restaurant.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as Record<string, unknown>;

  if (isSupport(session.role)) {
    const notes = body.notes !== undefined ? String(body.notes || "") : current.notes;
    const updated = await prisma.restaurant.update({
      where: { id },
      data: { notes },
    });
    return NextResponse.json(updated);
  }

  if (!isAdminOrSuper(session.role)) return forbidden();

  const nextPlan = body.plan !== undefined ? parsePlan(body.plan) : null;
  const nextStatus = body.status !== undefined ? parseStatus(body.status) : null;
  const nextHostingStatus = body.hostingStatus !== undefined ? parseHostingStatus(body.hostingStatus) : null;

  if (body.plan !== undefined && !nextPlan) return badRequest("Invalid plan");
  if (body.status !== undefined && !nextStatus) return badRequest("Invalid status");
  if (body.hostingStatus !== undefined && !nextHostingStatus) return badRequest("Invalid hostingStatus");

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
      name: body.name !== undefined ? String(body.name || "").trim() : undefined,
      domain: body.domain !== undefined ? String(body.domain || "").trim() : undefined,
      adminEmail: body.adminEmail !== undefined ? String(body.adminEmail || "").trim().toLowerCase() : undefined,
      ownerName: body.ownerName !== undefined ? String(body.ownerName || "").trim() : undefined,
      ownerEmail: body.ownerEmail !== undefined ? String(body.ownerEmail || "").trim().toLowerCase() : undefined,
      ownerPhone: body.ownerPhone !== undefined ? String(body.ownerPhone || "").trim() : undefined,
      plan: nextPlan || undefined,
      status: nextStatus || undefined,
      hosted: body.hosted !== undefined ? Boolean(body.hosted) : undefined,
      hostingStatus: nextHostingStatus || undefined,
      notes: body.notes !== undefined ? String(body.notes || "") : undefined,
      monthlyHostingActive:
        body.monthlyHostingActive !== undefined
          ? Boolean(body.monthlyHostingActive)
          : undefined,
      trialEndsAt: trialEndsAtValue,
      port:
        body.port !== undefined && Number.isFinite(Number(body.port)) && Number(body.port) > 0
          ? Math.trunc(Number(body.port))
          : undefined,
      dbPath: body.dbPath !== undefined ? String(body.dbPath || "") : undefined,
      licenseExpiry:
        body.licenseExpiry !== undefined
          ? (body.licenseExpiry ? new Date(String(body.licenseExpiry)) : null)
          : undefined,
    },
  });

  if (nextStatus && nextStatus !== current.status) {
    await createLicenseEvent({
      restaurantId: id,
      event: LicenseEventType.STATUS_CHANGED,
      details: `Status changed from ${current.status} to ${nextStatus}`,
      performedBy: session.email,
    });
  }

  if (nextPlan && nextPlan !== current.plan) {
    await createLicenseEvent({
      restaurantId: id,
      event: LicenseEventType.PLAN_CHANGED,
      details: `Plan changed from ${current.plan} to ${nextPlan}`,
      performedBy: session.email,
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = (() => {
    try {
      return requireSessionFromRequest(req);
    } catch {
      return null;
    }
  })();
  if (!session) return unauthorized();
  if (!isAdminOrSuper(session.role)) return forbidden();

  const { id } = await params;

  const existing = await prisma.restaurant.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.restaurant.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
