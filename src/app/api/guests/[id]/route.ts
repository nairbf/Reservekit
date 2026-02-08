import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const { id } = await params;
  const guest = await prisma.guest.findUnique({
    where: { id: parseInt(id) },
    include: {
      reservations: {
        orderBy: { date: "desc" },
        take: 20,
        include: { table: true },
      },
    },
  });

  if (!guest) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(guest);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const { id } = await params;
  const body = await req.json();

  const guest = await prisma.guest.update({
    where: { id: parseInt(id) },
    data: {
      vipStatus: body.vipStatus ?? undefined,
      dietaryNotes: body.dietaryNotes ?? undefined,
      allergyNotes: body.allergyNotes ?? undefined,
      generalNotes: body.generalNotes ?? undefined,
      tags: body.tags ?? undefined,
      name: body.name ?? undefined,
      email: body.email ?? undefined,
    },
  });

  return NextResponse.json(guest);
}
