import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { isModuleActive } from "@/lib/license";
import { autoMatchTables } from "@/lib/spoton";

interface MappingInput {
  spotOnTable: string;
  reservekitTableId: number;
}

async function ensureLicensed() {
  const licensed = await isModuleActive("pos");
  if (!licensed) {
    return NextResponse.json({ error: "POS integration requires a license", licensed: false }, { status: 403 });
  }
  return null;
}

export async function GET() {
  try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const licenseError = await ensureLicensed();
  if (licenseError) return licenseError;

  const [mappingRows, tables] = await Promise.all([
    prisma.setting.findMany({ where: { key: { startsWith: "spoton_table_" } }, orderBy: { key: "asc" } }),
    prisma.restaurantTable.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  const mappings = mappingRows
    .map(row => ({
      spotOnTable: row.key.replace("spoton_table_", ""),
      reservekitTableId: parseInt(row.value, 10),
    }))
    .filter(row => row.spotOnTable && !Number.isNaN(row.reservekitTableId));

  return NextResponse.json({ mappings, tables });
}

export async function POST(req: NextRequest) {
  try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const licenseError = await ensureLicensed();
  if (licenseError) return licenseError;

  const body = (await req.json()) as { mappings?: MappingInput[] };
  const mappings = Array.isArray(body.mappings) ? body.mappings : [];
  let saved = 0;

  for (const item of mappings) {
    const spotOnTable = String(item.spotOnTable || "").trim();
    const reservekitTableId = Number(item.reservekitTableId);
    if (!spotOnTable || !Number.isFinite(reservekitTableId) || reservekitTableId <= 0) continue;
    await prisma.setting.upsert({
      where: { key: `spoton_table_${spotOnTable}` },
      update: { value: String(Math.trunc(reservekitTableId)) },
      create: { key: `spoton_table_${spotOnTable}`, value: String(Math.trunc(reservekitTableId)) },
    });
    saved++;
  }

  return NextResponse.json({ ok: true, saved });
}

export async function PUT(req: NextRequest) {
  try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const licenseError = await ensureLicensed();
  if (licenseError) return licenseError;

  const body = (await req.json()) as { action?: string };
  if (body.action !== "auto") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
  const matches = await autoMatchTables();
  return NextResponse.json({ ok: true, matches, count: matches.length });
}
