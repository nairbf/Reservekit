import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { LicenseEventType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireSessionFromRequest } from "@/lib/auth";
import { isAdminOrSuper } from "@/lib/rbac";
import { forbidden, unauthorized } from "@/lib/api";
import { createLicenseEvent } from "@/lib/license-events";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const licenseKey = randomUUID();
  const updated = await prisma.restaurant.update({
    where: { id },
    data: {
      licenseKey,
      licenseActivatedAt: null,
    },
  });

  await createLicenseEvent({
    restaurantId: id,
    event: LicenseEventType.LICENSE_KEY_ROTATED,
    details: "License key regenerated",
    performedBy: session.email,
  });

  return NextResponse.json({ licenseKey: updated.licenseKey, generatedAt: new Date().toISOString() });
}
