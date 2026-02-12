import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSessionFromRequest } from "@/lib/auth";
import { unauthorized } from "@/lib/api";

export async function GET(req: NextRequest, { params }: { params: Promise<{ restaurantId: string }> }) {
  try {
    requireSessionFromRequest(req);
  } catch {
    return unauthorized();
  }

  const { restaurantId } = await params;
  const { searchParams } = new URL(req.url);
  const takeRaw = Number(searchParams.get("take") || "50");
  const take = Number.isFinite(takeRaw) ? Math.max(1, Math.min(200, takeRaw)) : 50;

  const rows = await prisma.healthCheck.findMany({
    where: { restaurantId },
    orderBy: { checkedAt: "desc" },
    take,
  });

  return NextResponse.json(rows);
}
