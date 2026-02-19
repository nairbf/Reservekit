import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

function parseId(id: string): number | null {
  const n = Number(id);
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
  const categoryId = parseId(id);
  if (!categoryId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json();
  const typeRaw = body?.type !== undefined ? String(body.type || "").toLowerCase() : undefined;
  const type = typeRaw ? (typeRaw === "drink" ? "drink" : "starter") : undefined;
  const updated = await prisma.menuCategory.update({
    where: { id: categoryId },
    data: {
      name: body?.name !== undefined ? String(body.name || "").trim() : undefined,
      type,
      sortOrder: body?.sortOrder !== undefined ? Math.trunc(Number(body.sortOrder || 0)) : undefined,
      isActive: body?.isActive !== undefined ? Boolean(body.isActive) : undefined,
    },
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
  const categoryId = parseId(id);
  if (!categoryId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const itemCount = await prisma.menuItem.count({ where: { categoryId } });
  if (itemCount > 0) {
    return NextResponse.json({ error: "Cannot delete a category that still has items." }, { status: 409 });
  }

  await prisma.menuCategory.delete({ where: { id: categoryId } });
  return NextResponse.json({ ok: true });
}
