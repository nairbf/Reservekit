import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { dollarsToCents } from "@/lib/preorder";

function parseId(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("manage_menu");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const itemId = parseId(id);
  if (!itemId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json();
  const price =
    body?.price !== undefined
      ? dollarsToCents(body.price)
      : body?.priceCents !== undefined
        ? Math.max(0, Math.trunc(Number(body.priceCents || 0)))
        : undefined;

  const updated = await prisma.menuItem.update({
    where: { id: itemId },
    data: {
      categoryId: body?.categoryId !== undefined ? Math.trunc(Number(body.categoryId)) : undefined,
      name: body?.name !== undefined ? String(body.name || "").trim() : undefined,
      description: body?.description !== undefined ? (body.description ? String(body.description) : null) : undefined,
      price,
      dietaryTags: body?.dietaryTags !== undefined ? (body.dietaryTags ? String(body.dietaryTags) : null) : undefined,
      sortOrder: body?.sortOrder !== undefined ? Math.trunc(Number(body.sortOrder || 0)) : undefined,
      isAvailable: body?.isAvailable !== undefined ? Boolean(body.isAvailable) : undefined,
    },
    include: { category: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("manage_menu");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const itemId = parseId(id);
  if (!itemId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  await prisma.menuItem.delete({ where: { id: itemId } });
  return NextResponse.json({ ok: true });
}
