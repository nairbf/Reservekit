import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";

function maskValue(value: string, prefixLength: number): string {
  if (!value) return value;
  if (value.length <= prefixLength + 4) return value;
  return `${value.slice(0, prefixLength)}••••••••${value.slice(-4)}`;
}

function isMaskedStripeValue(value: string): boolean {
  return value.includes("•") || value.includes("*");
}

export async function GET() {
  try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const rows = await prisma.setting.findMany({
    where: {
      NOT: [
        { key: { startsWith: "pos_status_" } },
        { key: { startsWith: "spoton_table_" } },
        { key: { startsWith: "loyalty_phone_" } },
      ],
    },
  });
  const s: Record<string, string> = {};
  for (const r of rows) {
    if (r.key === "stripeSecretKey") {
      s[r.key] = maskValue(r.value, 7);
      continue;
    }
    if (r.key === "stripeWebhookSecret") {
      s[r.key] = maskValue(r.value, 6);
      continue;
    }
    s[r.key] = r.value;
  }
  return NextResponse.json(s);
}

export async function PUT(req: NextRequest) {
  try { await requirePermission("manage_settings"); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  const data = (await req.json()) as Record<string, string>;
  for (const [key, value] of Object.entries(data)) {
    const nextValue = String(value ?? "");
    if ((key === "stripeSecretKey" || key === "stripeWebhookSecret") && isMaskedStripeValue(nextValue)) {
      continue;
    }
    await prisma.setting.upsert({ where: { key }, update: { value: nextValue }, create: { key, value: nextValue } });
  }
  return NextResponse.json({ ok: true });
}
