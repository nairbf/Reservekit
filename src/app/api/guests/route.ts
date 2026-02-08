import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const { searchParams } = new URL(req.url);
  const search = (searchParams.get("search") || "").trim();

  const where = search
    ? {
        OR: [
          { name: { contains: search } },
          { phone: { contains: search } },
        ],
      }
    : {};

  const guests = await prisma.guest.findMany({
    where,
    orderBy: [{ totalVisits: "desc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json(guests);
}
