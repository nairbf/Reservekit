import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { getExpressDiningConfig } from "@/lib/preorder";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const isPublic = searchParams.get("public") === "true";

  if (!isPublic) {
    try {
      await requireAuth();
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const config = await getExpressDiningConfig();
  if (isPublic && !config.enabled) {
    return NextResponse.json({ error: "Express Dining is not enabled." }, { status: 403 });
  }
  const categories = await prisma.menuCategory.findMany({
    where: isPublic ? { isActive: true } : {},
    include: {
      items: {
        where: isPublic ? { isAvailable: true } : {},
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  let payload = categories;
  if (isPublic) payload = payload.filter(cat => cat.items.length > 0);

  if (isPublic && config.mode === "browse") {
    return NextResponse.json(
      payload.map(cat => ({
        ...cat,
        items: cat.items.map(item => ({
          id: item.id,
          categoryId: item.categoryId,
          name: item.name,
          description: item.description,
          dietaryTags: item.dietaryTags,
          isAvailable: item.isAvailable,
          sortOrder: item.sortOrder,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })),
      })),
    );
  }

  return NextResponse.json(payload);
}

export async function POST(req: NextRequest) {
  try {
    await requirePermission("manage_menu");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const name = String(body?.name || "").trim();
  if (!name) return NextResponse.json({ error: "Category name is required" }, { status: 400 });
  const typeRaw = String(body?.type || "starter").toLowerCase();
  const type = typeRaw === "drink" ? "drink" : "starter";

  const created = await prisma.menuCategory.create({
    data: {
      name,
      type,
      sortOrder: Number.isFinite(Number(body?.sortOrder)) ? Math.trunc(Number(body.sortOrder)) : 0,
      isActive: body?.isActive !== false,
    },
  });
  return NextResponse.json(created, { status: 201 });
}
