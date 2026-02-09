import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

function parseId(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const itemId = parseId(id);
  if (!itemId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json();
  const available = Boolean(body?.available);
  const updated = await prisma.menuItem.update({
    where: { id: itemId },
    data: { isAvailable: available },
  });
  return NextResponse.json(updated);
}

