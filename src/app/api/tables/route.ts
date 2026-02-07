import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  return NextResponse.json(await prisma.restaurantTable.findMany({ orderBy: { sortOrder: "asc" } }));
}

export async function POST(req: NextRequest) {
  try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const data = await req.json();
  const table = await prisma.restaurantTable.create({ data: { name: data.name, section: data.section || null, minCapacity: data.minCapacity || 1, maxCapacity: data.maxCapacity || 4, sortOrder: data.sortOrder || 0 } });
  return NextResponse.json(table, { status: 201 });
}
