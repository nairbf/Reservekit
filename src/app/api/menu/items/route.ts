import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { dollarsToCents } from "@/lib/preorder";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const categoryIdParam = searchParams.get("categoryId");
  const categoryId = categoryIdParam ? Math.trunc(Number(categoryIdParam)) : null;

  const items = await prisma.menuItem.findMany({
    where: categoryId ? { categoryId } : {},
    include: { category: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  try {
    await requirePermission("manage_menu");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const categoryId = Math.trunc(Number(body?.categoryId));
  const name = String(body?.name || "").trim();
  const price = dollarsToCents(body?.price);
  if (!categoryId || !name || price <= 0) {
    return NextResponse.json({ error: "categoryId, name, and price are required" }, { status: 400 });
  }

  const created = await prisma.menuItem.create({
    data: {
      categoryId,
      name,
      description: body?.description ? String(body.description) : null,
      price,
      dietaryTags: body?.dietaryTags ? String(body.dietaryTags) : null,
      sortOrder: Number.isFinite(Number(body?.sortOrder)) ? Math.trunc(Number(body.sortOrder)) : 0,
      isAvailable: body?.isAvailable !== false,
    },
    include: { category: true },
  });
  return NextResponse.json(created, { status: 201 });
}
