import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { LicenseEventType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { isAdminOrSuper } from "@/lib/rbac";
import { forbidden, unauthorized } from "@/lib/api";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession().catch(() => null);
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

  await prisma.licenseEvent.create({
    data: {
      restaurantId: id,
      event: LicenseEventType.KEY_ROTATED,
      details: "License key rotated",
      performedBy: session.email,
    },
  });

  return NextResponse.json({ licenseKey: updated.licenseKey });
}
