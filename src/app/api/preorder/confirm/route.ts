import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const preOrderId = Math.trunc(Number(body?.preOrderId || 0));
  if (!preOrderId) return NextResponse.json({ error: "preOrderId is required" }, { status: 400 });

  const updated = await prisma.preOrder.update({
    where: { id: preOrderId },
    data: { status: "confirmed_by_staff", updatedAt: new Date() },
    include: {
      reservation: true,
      items: { include: { menuItem: true }, orderBy: [{ guestLabel: "asc" }, { id: "asc" }] },
    },
  });
  return NextResponse.json(updated);
}

