import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requirePermission("manage_schedule"); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  const { id } = await params;
  await prisma.dayOverride.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ ok: true });
}
