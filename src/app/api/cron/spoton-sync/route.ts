import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isModuleActive } from "@/lib/license";
import { extractChecksFromOrders, getTableMapping, syncSpotOn } from "@/lib/spoton";
import { getRestaurantTimezone, getTodayInTimezone } from "@/lib/timezone";
import { updateGuestStats } from "@/lib/guest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SpotOnStatusPayload = {
  orderId: string;
  checkTotal: string;
  balanceDue: string;
  serverName: string;
  openedAt: string;
  closedAt: string | null;
  isOpen: boolean;
  syncedAt: string;
};

function clean(value: string): string {
  return value.trim();
}

function normalizeKey(value: string): string {
  return clean(value).toUpperCase().replace(/\s+/g, "");
}

function buildLookupCandidates(tableNumber: string): string[] {
  const raw = clean(tableNumber);
  const normalized = normalizeKey(raw);
  const set = new Set<string>();
  if (raw) set.add(raw);
  if (normalized) set.add(normalized);

  const digitsMatch = normalized.match(/\d+/g);
  if (digitsMatch && digitsMatch.length > 0) {
    const digits = String(parseInt(digitsMatch[0], 10));
    if (digits && digits !== "NaN") {
      set.add(digits);
      set.add(`T${digits}`);
      set.add(`TABLE${digits}`);
    }
  }

  if (/^TABLE\d+$/.test(normalized)) set.add(normalized.replace(/^TABLE/, "T"));
  if (/^T\d+$/.test(normalized)) set.add(normalized.replace(/^T/, ""));
  return [...set].filter(Boolean);
}

function resolveMappedTableId(mapping: Map<string, number>, tableNumber: string): number | null {
  if (!tableNumber) return null;
  const normalizedMap = new Map<string, number>();
  for (const [key, tableId] of mapping.entries()) normalizedMap.set(normalizeKey(key), tableId);

  const candidates = buildLookupCandidates(tableNumber);
  for (const candidate of candidates) {
    if (mapping.has(candidate)) return mapping.get(candidate) || null;
    const normalizedCandidate = normalizeKey(candidate);
    if (normalizedMap.has(normalizedCandidate)) return normalizedMap.get(normalizedCandidate) || null;
  }
  return null;
}

function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function getMockOrders() {
  return [
    {
      id: "MOCK-1001",
      orderTypeName: "Dine In",
      tableNumber: "12",
      totalAmount: "47.20",
      balanceDueAmount: "12.00",
      createdAt: isoMinutesAgo(42),
      closedAt: null,
      ownerInfo: { employeeName: "Mike" },
    },
    {
      id: "MOCK-1002",
      orderTypeName: "Dine-In",
      tableNumber: "7",
      totalAmount: "86.55",
      balanceDueAmount: "0.00",
      createdAt: isoMinutesAgo(95),
      closedAt: null,
      ownerInfo: { employeeName: "Ana" },
    },
    {
      id: "MOCK-1003",
      orderTypeName: "Dine In",
      tableNumber: "B1",
      totalAmount: "31.40",
      balanceDueAmount: "18.00",
      createdAt: isoMinutesAgo(18),
      closedAt: null,
      ownerInfo: { employeeName: "Leo" },
    },
    {
      id: "MOCK-2001",
      orderTypeName: "Dine In",
      tableNumber: "4",
      totalAmount: "64.10",
      balanceDueAmount: "0.00",
      createdAt: isoMinutesAgo(70),
      closedAt: isoMinutesAgo(6),
      ownerInfo: { employeeName: "Priya" },
    },
    {
      id: "MOCK-2002",
      orderTypeName: "Dine In",
      tableNumber: "15",
      totalAmount: "22.00",
      balanceDueAmount: "0.00",
      createdAt: isoMinutesAgo(30),
      closedAt: isoMinutesAgo(8),
      ownerInfo: { employeeName: "Sam" },
    },
    {
      id: "MOCK-TOGO-1",
      orderTypeName: "Takeout",
      tableNumber: "0",
      totalAmount: "19.50",
      balanceDueAmount: "0.00",
      createdAt: isoMinutesAgo(20),
      closedAt: null,
      ownerInfo: { employeeName: "Counter" },
    },
  ];
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET || "";
  const provided = req.headers.get("x-cron-secret") || "";
  if (secret && provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [apiKeyRow, locationRow] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "spotonApiKey" } }),
    prisma.setting.findUnique({ where: { key: "spotonLocationId" } }),
  ]);

  const configured = Boolean(clean(apiKeyRow?.value || "") && clean(locationRow?.value || ""));
  if (!configured) {
    return NextResponse.json({ skipped: true, reason: "SpotOn not configured" });
  }

  const licensed = await isModuleActive("pos");
  if (!licensed) {
    return NextResponse.json({ skipped: true, reason: "POS module not licensed" });
  }

  const mockRow = await prisma.setting.findUnique({ where: { key: "spotonUseMock" } });
  const useMock = String(mockRow?.value || "").toLowerCase() === "true";

  const syncResult = useMock
    ? (() => {
        const checks = extractChecksFromOrders(getMockOrders());
        return {
          success: true as const,
          timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
          openChecks: checks.openChecks,
          closedChecks: checks.closedChecks,
        };
      })()
    : await syncSpotOn();

  if (!syncResult.success) {
    return NextResponse.json({
      success: false,
      error: syncResult.error,
      timestamp: syncResult.timestamp,
    });
  }

  const mapping = await getTableMapping();
  const openStatusKeys = new Set<string>();
  for (const check of syncResult.openChecks) {
    const tableId = resolveMappedTableId(mapping, check.tableNumber);
    if (!tableId) continue;
    const statusKey = `pos_status_${tableId}`;
    openStatusKeys.add(statusKey);

    const payload: SpotOnStatusPayload = {
      orderId: check.orderId,
      checkTotal: check.checkTotal,
      balanceDue: check.balanceDue,
      serverName: check.serverName,
      openedAt: check.openedAt,
      closedAt: check.closedAt,
      isOpen: true,
      syncedAt: syncResult.timestamp,
    };

    await prisma.setting.upsert({
      where: { key: statusKey },
      update: { value: JSON.stringify(payload) },
      create: { key: statusKey, value: JSON.stringify(payload) },
    });
  }

  const timezone = await getRestaurantTimezone();
  const today = getTodayInTimezone(timezone);
  let autoCompleted = 0;

  for (const check of syncResult.closedChecks) {
    const tableId = resolveMappedTableId(mapping, check.tableNumber);
    if (!tableId) continue;

    const reservation = await prisma.reservation.findFirst({
      where: { tableId, status: "seated", date: today },
      orderBy: [{ seatedAt: "desc" }, { updatedAt: "desc" }],
    });

    if (reservation) {
      const updated = await prisma.reservation.update({
        where: { id: reservation.id },
        data: { status: "completed", completedAt: new Date() },
      });
      if (updated.guestId) {
        updateGuestStats(updated.guestId).catch(() => undefined);
      }
      autoCompleted += 1;
    }

    const statusKey = `pos_status_${tableId}`;
    if (!openStatusKeys.has(statusKey)) {
      await prisma.setting.deleteMany({ where: { key: statusKey } });
    }
  }

  const existing = await prisma.setting.findMany({ where: { key: { startsWith: "pos_status_" } } });
  for (const row of existing) {
    if (!openStatusKeys.has(row.key)) {
      await prisma.setting.deleteMany({ where: { key: row.key } });
    }
  }

  await prisma.setting.upsert({
    where: { key: "spotonLastSync" },
    update: { value: syncResult.timestamp },
    create: { key: "spotonLastSync", value: syncResult.timestamp },
  });

  await prisma.setting.upsert({
    where: { key: "spotonLastOpenChecks" },
    update: { value: String(syncResult.openChecks.length) },
    create: { key: "spotonLastOpenChecks", value: String(syncResult.openChecks.length) },
  });

  return NextResponse.json({
    success: true,
    timestamp: syncResult.timestamp,
    openChecks: syncResult.openChecks.length,
    closedChecks: syncResult.closedChecks.length,
    autoCompleted,
    useMock,
  });
}
