import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requirePermission("manage_tables"); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  const { id } = await params;
  const data = await req.json();
  return NextResponse.json(await prisma.restaurantTable.update({ where: { id: parseInt(id) }, data }));
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requirePermission("manage_tables"); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  const { id } = await params;
  await prisma.restaurantTable.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ ok: true });
}
