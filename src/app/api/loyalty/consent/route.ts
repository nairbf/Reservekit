import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getLoyaltyConsent, normalizeLoyaltyPhone } from "@/lib/loyalty";

async function isLoyaltyEnabled(): Promise<boolean> {
  const row = await prisma.setting.findUnique({ where: { key: "loyaltyOptInEnabled" } });
  return row?.value === "true";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawPhone = searchParams.get("phone") || "";
  const normalized = normalizeLoyaltyPhone(rawPhone);
  const enabled = await isLoyaltyEnabled();

  if (!enabled) {
    return NextResponse.json({ enabled: false, known: false, optedIn: false });
  }

  if (!normalized) {
    return NextResponse.json({ enabled: true, known: false, optedIn: false });
  }

  const consent = await getLoyaltyConsent(normalized);
  if (!consent) {
    return NextResponse.json({ enabled: true, known: false, optedIn: false });
  }

  return NextResponse.json({
    enabled: true,
    known: true,
    optedIn: consent.optedIn,
    updatedAt: consent.updatedAt,
  });
}
