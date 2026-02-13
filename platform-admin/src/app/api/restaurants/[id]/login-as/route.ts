import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { LicenseEventType } from "@/generated/prisma/client";
import { requireSessionFromRequest, getJwtSecret } from "@/lib/auth";
import { forbidden, unauthorized } from "@/lib/api";
import { prisma } from "@/lib/db";
import { createLicenseEvent } from "@/lib/license-events";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = (() => {
    try {
      return requireSessionFromRequest(request);
    } catch {
      return null;
    }
  })();

  if (!session) return unauthorized();
  if (session.role !== "SUPER_ADMIN") return forbidden();

  const { id } = await params;
  const restaurant = await prisma.restaurant.findUnique({ where: { id } });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const token = jwt.sign(
    {
      type: "admin_login",
      restaurantId: restaurant.id,
      restaurantSlug: restaurant.slug,
      adminEmail: session.email,
      adminName: session.name,
    },
    getJwtSecret(),
    { expiresIn: "5m" },
  );

  const domain = restaurant.domain || `${restaurant.slug}.reservesit.com`;
  const loginUrl = `https://${domain}/api/auth/admin-login?token=${encodeURIComponent(token)}`;

  await createLicenseEvent({
    restaurantId: restaurant.id,
    event: LicenseEventType.ADMIN_LOGIN,
    details: `Admin ${session.email} used Login As`,
    performedBy: session.email,
  });

  return NextResponse.json({ loginUrl });
}
