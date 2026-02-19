import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { sanitizeString } from "@/lib/validate";

export async function GET(req: NextRequest) {
  try { await requirePermission("view_guests"); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

  const { searchParams } = new URL(req.url);
  const search = sanitizeString(searchParams.get("search"), 120);

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
