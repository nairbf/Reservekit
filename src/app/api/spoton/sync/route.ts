import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { isModuleActive } from "@/lib/license";
import { updateGuestStats } from "@/lib/guest";
import { extractChecksFromOrders, getTableMapping, syncSpotOn, type SpotOnSyncResult, type SpotOnTableStatus } from "@/lib/spoton";
import { getRestaurantTimezone, getTodayInTimezone } from "@/lib/timezone";

interface PosStatusSetting {
  orderId: string;
  checkTotal: string;
  balanceDue: string;
  serverName: string;
  openedAt: string;
  closedAt: string | null;
  isOpen: boolean;
  syncedAt: string;
}

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

  if (/^TABLE\d+$/.test(normalized)) {
    set.add(normalized.replace(/^TABLE/, "T"));
  }
  if (/^T\d+$/.test(normalized)) {
    set.add(normalized.replace(/^T/, ""));
  }

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

function parsePosPayload(value: string): PosStatusSetting | null {
  try {
    const parsed = JSON.parse(value) as Partial<PosStatusSetting>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      orderId: String(parsed.orderId || ""),
      checkTotal: String(parsed.checkTotal || "0.00"),
      balanceDue: String(parsed.balanceDue || "0.00"),
      serverName: String(parsed.serverName || ""),
      openedAt: String(parsed.openedAt || ""),
      closedAt: parsed.closedAt ? String(parsed.closedAt) : null,
      isOpen: Boolean(parsed.isOpen),
      syncedAt: String(parsed.syncedAt || ""),
    };
  } catch {
    return null;
  }
}

async function getUseMock() {
  const row = await prisma.setting.findUnique({ where: { key: "spotonUseMock" } });
  return String(row?.value || "").toLowerCase() === "true";
}

async function getMockSync(req: NextRequest): Promise<SpotOnSyncResult> {
  const mockUrl = new URL("/api/spoton/mock", req.url);
  const mockResponse = await fetch(mockUrl.toString(), {
    method: "GET",
    headers: { cookie: req.headers.get("cookie") || "" },
    cache: "no-store",
  });
  if (!mockResponse.ok) {
    const text = await mockResponse.text();
    return {
      success: false,
      error: text || `Mock endpoint failed (${mockResponse.status})`,
      timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
      openChecks: [],
      closedChecks: [],
    };
  }
  const payload = (await mockResponse.json()) as { orders?: unknown[] } | unknown[];
  const orders = Array.isArray(payload) ? payload : (Array.isArray(payload.orders) ? payload.orders : []);
  const { openChecks, closedChecks } = extractChecksFromOrders(orders);
  return {
    success: true,
    timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    openChecks,
    closedChecks,
  };
}

async function writeOpenCheckStatuses(mapping: Map<string, number>, openChecks: SpotOnTableStatus[], syncedAt: string) {
  const openStatusKeys = new Set<string>();
  for (const check of openChecks) {
    const tableId = resolveMappedTableId(mapping, check.tableNumber);
    if (!tableId) continue;
    const key = `pos_status_${tableId}`;
    const payload: PosStatusSetting = {
      orderId: check.orderId,
      checkTotal: check.checkTotal,
      balanceDue: check.balanceDue,
      serverName: check.serverName,
      openedAt: check.openedAt,
      closedAt: check.closedAt,
      isOpen: true,
      syncedAt,
    };
    openStatusKeys.add(key);
    await prisma.setting.upsert({
      where: { key },
      update: { value: JSON.stringify(payload) },
      create: { key, value: JSON.stringify(payload) },
    });
  }
  return openStatusKeys;
}

async function processClosedChecks(mapping: Map<string, number>, closedChecks: SpotOnTableStatus[], openStatusKeys: Set<string>) {
  const timezone = await getRestaurantTimezone();
  const today = getTodayInTimezone(timezone);
  const now = new Date();
  const autoCompletedReservations: Array<{ reservationId: number; tableId: number; orderId: string }> = [];

  for (const check of closedChecks) {
    const tableId = resolveMappedTableId(mapping, check.tableNumber);
    if (!tableId) continue;

    const reservation = await prisma.reservation.findFirst({
      where: { tableId, status: "seated", date: today },
      orderBy: [{ seatedAt: "desc" }, { updatedAt: "desc" }],
    });

    if (reservation) {
      const updated = await prisma.reservation.update({
        where: { id: reservation.id },
        data: { status: "completed", completedAt: now },
      });
      if (updated.guestId) {
        updateGuestStats(updated.guestId).catch(console.error);
      }
      await prisma.notificationLog.create({
        data: {
          reservationId: updated.id,
          channel: "system",
          recipient: "system",
          messageType: "pos_auto_complete",
          body: "Auto-completed via SpotOn POS sync (check closed)",
        },
      });
      autoCompletedReservations.push({
        reservationId: updated.id,
        tableId,
        orderId: check.orderId,
      });
    }

    const key = `pos_status_${tableId}`;
    if (!openStatusKeys.has(key)) {
      await prisma.setting.deleteMany({ where: { key } });
    }
  }

  return autoCompletedReservations;
}

async function clearStaleStatuses(openStatusKeys: Set<string>) {
  const existing = await prisma.setting.findMany({ where: { key: { startsWith: "pos_status_" } } });
  for (const row of existing) {
    if (!openStatusKeys.has(row.key)) {
      await prisma.setting.deleteMany({ where: { key: row.key } });
    }
  }
}

async function ensureLicensed() {
  const licensed = await isModuleActive("pos");
  if (!licensed) {
    return NextResponse.json({ error: "POS integration requires a license", licensed: false }, { status: 403 });
  }
  return null;
}

export async function POST(req: NextRequest) {
  try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const licenseError = await ensureLicensed();
  if (licenseError) return licenseError;

  const useMock = await getUseMock();
  const syncResult = useMock ? await getMockSync(req) : await syncSpotOn();
  if (!syncResult.success) {
    return NextResponse.json(syncResult, { status: 400 });
  }

  const mapping = await getTableMapping();
  const openStatusKeys = await writeOpenCheckStatuses(mapping, syncResult.openChecks, syncResult.timestamp);
  const autoCompletedReservations = await processClosedChecks(mapping, syncResult.closedChecks, openStatusKeys);
  await clearStaleStatuses(openStatusKeys);

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
    ...syncResult,
    autoCompletedReservations,
    useMock,
  });
}

export async function GET() {
  try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const licenseError = await ensureLicensed();
  if (licenseError) return licenseError;

  const [statusRows, lastSyncRow, apiKeyRow, locationRow] = await Promise.all([
    prisma.setting.findMany({ where: { key: { startsWith: "pos_status_" } }, orderBy: { key: "asc" } }),
    prisma.setting.findUnique({ where: { key: "spotonLastSync" } }),
    prisma.setting.findUnique({ where: { key: "spotonApiKey" } }),
    prisma.setting.findUnique({ where: { key: "spotonLocationId" } }),
  ]);

  const status = statusRows
    .map(row => {
      const tableId = parseInt(row.key.replace("pos_status_", ""), 10);
      if (Number.isNaN(tableId)) return null;
      const parsed = parsePosPayload(row.value);
      if (!parsed) return null;
      return { tableId, ...parsed };
    })
    .filter((row): row is { tableId: number } & PosStatusSetting => Boolean(row));

  const configured = Boolean(clean(apiKeyRow?.value || "") && clean(locationRow?.value || ""));

  return NextResponse.json({
    licensed: true,
    configured,
    spotonLastSync: lastSyncRow?.value || null,
    openChecks: status.length,
    status,
  });
}
