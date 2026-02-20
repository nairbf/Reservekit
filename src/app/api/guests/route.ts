import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { sanitizeString } from "@/lib/validate";

type SortKey =
  | "visits_desc"
  | "visits_asc"
  | "last_visit_desc"
  | "last_visit_asc"
  | "name_asc"
  | "name_desc"
  | "noshow_desc"
  | "covers_desc";

type FilterKey = "all" | "vip" | "new" | "returning" | "noshow" | "allergies";

export async function GET(req: NextRequest) {
  try { await requirePermission("view_guests"); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

  const { searchParams } = new URL(req.url);
  const search = sanitizeString(searchParams.get("search"), 120);
  const sortParam = sanitizeString(searchParams.get("sort"), 30) as SortKey | null;
  const filterParam = sanitizeString(searchParams.get("filter"), 30) as FilterKey | null;
  const tag = sanitizeString(searchParams.get("tag"), 60);
  const sort: SortKey = sortParam || "visits_desc";
  const filter: FilterKey = filterParam || "all";

  const and: Record<string, unknown>[] = [];

  if (search) {
    and.push({
      OR: [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
      ],
    });
  }

  if (filter === "vip") {
    and.push({
      OR: [
        { vipStatus: "vip" },
        { totalVisits: { gte: 10 } },
      ],
    });
  } else if (filter === "new") {
    and.push({ totalVisits: { lte: 1 } });
  } else if (filter === "returning") {
    and.push({ totalVisits: { gt: 1 } });
  } else if (filter === "noshow") {
    and.push({ totalNoShows: { gt: 0 } });
  } else if (filter === "allergies") {
    and.push({
      OR: [
        {
          AND: [
            { allergyNotes: { not: null } },
            { allergyNotes: { not: "" } },
          ],
        },
        {
          AND: [
            { dietaryNotes: { not: null } },
            { dietaryNotes: { not: "" } },
          ],
        },
      ],
    });
  }

  if (tag) {
    and.push({ tags: { contains: tag } });
  }

  const where = and.length > 0 ? { AND: and } : {};

  const orderByMap: Record<SortKey, Record<string, "asc" | "desc">[]> = {
    visits_desc: [{ totalVisits: "desc" }, { updatedAt: "desc" }],
    visits_asc: [{ totalVisits: "asc" }, { updatedAt: "desc" }],
    last_visit_desc: [{ lastVisitDate: "desc" }, { updatedAt: "desc" }],
    last_visit_asc: [{ lastVisitDate: "asc" }, { updatedAt: "desc" }],
    name_asc: [{ name: "asc" }],
    name_desc: [{ name: "desc" }],
    noshow_desc: [{ totalNoShows: "desc" }, { totalVisits: "desc" }],
    covers_desc: [{ totalCovers: "desc" }, { totalVisits: "desc" }],
  };

  const guests = await prisma.guest.findMany({
    where,
    orderBy: orderByMap[sort] || orderByMap.visits_desc,
  });

  return NextResponse.json(guests);
}
