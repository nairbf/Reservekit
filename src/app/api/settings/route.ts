import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const rows = await prisma.setting.findMany();
  const s: Record<string, string> = {};
  for (const r of rows) s[r.key] = r.value;
  return NextResponse.json(s);
}

export async function PUT(req: NextRequest) {
  try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const data = (await req.json()) as Record<string, string>;
  for (const [key, value] of Object.entries(data)) {
    await prisma.setting.upsert({ where: { key }, update: { value: String(value) }, create: { key, value: String(value) } });
  }
  return NextResponse.json({ ok: true });
}
