import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-webhook-secret")?.trim();
  const expectedSecret = process.env.PLATFORM_WEBHOOK_SECRET?.trim();
  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = String(request.nextUrl.searchParams.get("email") || "")
    .trim()
    .toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const restaurant = await prisma.restaurant.findFirst({
    where: {
      OR: [{ ownerEmail: email }, { adminEmail: email }],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      name: true,
      plan: true,
      status: true,
      hosted: true,
      hostingStatus: true,
      licenseKey: true,
      licenseActivatedAt: true,
      licenseExpiry: true,
      monthlyHostingActive: true,
      ownerName: true,
      ownerEmail: true,
      domain: true,
      createdAt: true,
    },
  });

  if (!restaurant) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(restaurant);
}
