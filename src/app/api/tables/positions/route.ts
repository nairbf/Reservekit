import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function PUT(req: NextRequest) {
  try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const body = await req.json();
  const tables = Array.isArray(body?.tables) ? body.tables : null;
  if (!tables) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  await prisma.$transaction(
    tables.map((t: { id: number; posX: number; posY: number; rotation?: number }) =>
      prisma.restaurantTable.update({
        where: { id: Number(t.id) },
        data: { posX: t.posX, posY: t.posY, rotation: t.rotation ?? undefined },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
