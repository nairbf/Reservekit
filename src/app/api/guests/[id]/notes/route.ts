import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requirePermission("view_guests"); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

  const { id } = await params;
  const body = await req.json();
  const note = String(body.note || "").trim();
  if (!note) return NextResponse.json({ error: "Note is required" }, { status: 400 });

  const guest = await prisma.guest.findUnique({ where: { id: parseInt(id) } });
  if (!guest) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const stamp = new Date().toISOString().split("T")[0];
  const nextNotes = guest.generalNotes
    ? `${guest.generalNotes}\n[${stamp}] ${note}`
    : `[${stamp}] ${note}`;

  const updated = await prisma.guest.update({
    where: { id: guest.id },
    data: { generalNotes: nextNotes },
  });

  return NextResponse.json(updated);
}
