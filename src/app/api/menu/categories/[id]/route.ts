import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

function parseId(id: string): number | null {
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const categoryId = parseId(id);
  if (!categoryId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json();
  const updated = await prisma.menuCategory.update({
    where: { id: categoryId },
    data: {
      name: body?.name !== undefined ? String(body.name || "").trim() : undefined,
      sortOrder: body?.sortOrder !== undefined ? Math.trunc(Number(body.sortOrder || 0)) : undefined,
      isActive: body?.isActive !== undefined ? Boolean(body.isActive) : undefined,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const categoryId = parseId(id);
  if (!categoryId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const itemCount = await prisma.menuItem.count({ where: { categoryId } });
  if (itemCount > 0) {
    return NextResponse.json({ error: "Cannot delete a category that still has items." }, { status: 409 });
  }

  await prisma.menuCategory.delete({ where: { id: categoryId } });
  return NextResponse.json({ ok: true });
}

