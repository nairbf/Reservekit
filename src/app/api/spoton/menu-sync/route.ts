import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { isModuleActive } from "@/lib/license";
import { getSpotOnRuntimeConfig } from "@/lib/spoton";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SpotOnMenuItem = {
  id?: string;
  name?: string;
  deleted?: boolean;
  available?: boolean;
  openItem?: boolean;
  standardPriceAmount?: string | number;
};

function toCents(value: unknown): number {
  const num = typeof value === "number" ? value : parseFloat(String(value || "0"));
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.round(num * 100));
}

function normalizeMenuPayload(payload: unknown): SpotOnMenuItem[] {
  if (Array.isArray(payload)) return payload as SpotOnMenuItem[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items as SpotOnMenuItem[];
    if (Array.isArray(obj.data)) return obj.data as SpotOnMenuItem[];
  }
  return [];
}

async function getOrCreateSpotOnCategory() {
  const existing = await prisma.menuCategory.findFirst({
    where: { name: "From SpotOn" },
    orderBy: { id: "asc" },
  });
  if (existing) return existing;

  const maxOrder = await prisma.menuCategory.aggregate({ _max: { sortOrder: true } });
  return prisma.menuCategory.create({
    data: {
      name: "From SpotOn",
      type: "main",
      sortOrder: (maxOrder._max.sortOrder || 0) + 1,
      isActive: true,
    },
  });
}

export async function POST(_req: NextRequest) {
  try {
    await requirePermission("manage_integrations");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const licensed = await isModuleActive("pos");
  if (!licensed) {
    return NextResponse.json({ error: "POS license required" }, { status: 403 });
  }

  const mockRow = await prisma.setting.findUnique({ where: { key: "spotonUseMock" } });
  const useMock = String(mockRow?.value || "").toLowerCase() === "true";
  const cfg = await getSpotOnRuntimeConfig();
  if (!useMock && (!cfg.apiKey || !cfg.locationId)) {
    return NextResponse.json({ error: "SpotOn not configured" }, { status: 400 });
  }

  let items: SpotOnMenuItem[] = [];
  if (useMock) {
    items = [
      { id: "mock1", name: "Grilled Salmon", standardPriceAmount: "24.95", available: true, deleted: false, openItem: false },
      { id: "mock2", name: "Caesar Salad", standardPriceAmount: "12.50", available: true, deleted: false, openItem: false },
      { id: "mock3", name: "NY Strip Steak", standardPriceAmount: "38.00", available: true, deleted: false, openItem: false },
      { id: "mock4", name: "Chicken Parmesan", standardPriceAmount: "19.95", available: true, deleted: false, openItem: false },
      { id: "mock5", name: "Open Food Item", standardPriceAmount: "0", available: true, deleted: false, openItem: true },
    ];
  } else {
    const url = `${cfg.baseUrl}/locations/${encodeURIComponent(cfg.locationId)}/menu-items`;
    const response = await fetch(url, {
      method: "GET",
      headers: { "x-api-key": cfg.apiKey },
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({ error: `SpotOn API error: ${text || response.status}` }, { status: 400 });
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return NextResponse.json({ error: "SpotOn API returned invalid JSON" }, { status: 400 });
    }
    items = normalizeMenuPayload(payload);
  }

  const category = await getOrCreateSpotOnCategory();
  const maxOrder = await prisma.menuItem.aggregate({
    where: { categoryId: category.id },
    _max: { sortOrder: true },
  });
  let nextSortOrder = (maxOrder._max.sortOrder || 0) + 1;

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    if (item.deleted || item.openItem) {
      skipped += 1;
      continue;
    }

    const name = String(item.name || "").trim();
    if (!name) {
      skipped += 1;
      continue;
    }

    const price = toCents(item.standardPriceAmount);
    const isAvailable = item.available !== false;
    const existing = await prisma.menuItem.findFirst({ where: { name } });

    if (existing) {
      await prisma.menuItem.update({
        where: { id: existing.id },
        data: { price, isAvailable },
      });
      updated += 1;
    } else {
      await prisma.menuItem.create({
        data: {
          categoryId: category.id,
          name,
          price,
          isAvailable,
          sortOrder: nextSortOrder,
        },
      });
      nextSortOrder += 1;
      created += 1;
    }
  }

  const timestamp = new Date().toISOString();
  await prisma.setting.upsert({
    where: { key: "spotonLastMenuSync" },
    update: { value: timestamp },
    create: { key: "spotonLastMenuSync", value: timestamp },
  });

  return NextResponse.json({
    success: true,
    total: items.length,
    created,
    updated,
    skipped,
    useMock,
    timestamp,
  });
}
