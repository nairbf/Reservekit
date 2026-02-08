import { prisma } from "./db";

const PROD_BASE_URL = "https://restaurantapi.spoton.com/posexport/v1";
const QA_BASE_URL = "https://restaurantapi-qa.spoton.com/posexport/v1";

type JsonObject = Record<string, unknown>;

export interface SpotOnTableStatus {
  tableNumber: string;
  orderId: string;
  isOpen: boolean;
  checkTotal: string;
  balanceDue: string;
  openedAt: string;
  closedAt: string | null;
  serverName: string;
}

export interface SpotOnSyncResult {
  success: boolean;
  error?: string;
  timestamp: string;
  openChecks: SpotOnTableStatus[];
  closedChecks: SpotOnTableStatus[];
}

export interface SpotOnMatch {
  spotOnTable: string;
  reservekitTableId: number;
  tableName: string;
}

function toRFC3339NoMs(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readNestedString(root: unknown, path: string[]): string {
  let cursor: unknown = root;
  for (const key of path) {
    if (!cursor || typeof cursor !== "object") return "";
    cursor = (cursor as JsonObject)[key];
  }
  return cleanString(cursor);
}

function toMoneyString(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return value.toFixed(2);
  const raw = cleanString(value);
  if (!raw) return "0.00";
  const num = Number(raw);
  if (Number.isFinite(num)) return num.toFixed(2);
  return raw;
}

function parseOrders(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const obj = payload as JsonObject;
    if (Array.isArray(obj.orders)) return obj.orders;
    if (Array.isArray(obj.data)) return obj.data;
    if (obj.result && typeof obj.result === "object" && Array.isArray((obj.result as JsonObject).orders)) {
      return (obj.result as JsonObject).orders as unknown[];
    }
  }
  return [];
}

function looksLikeDineIn(orderTypeName: string): boolean {
  return /dine/i.test(orderTypeName);
}

function inferTableNumber(order: unknown): string {
  const direct = [
    readNestedString(order, ["tableNumber"]),
    readNestedString(order, ["tableName"]),
    readNestedString(order, ["table", "number"]),
    readNestedString(order, ["table", "name"]),
    readNestedString(order, ["tableInfo", "number"]),
    readNestedString(order, ["tableInfo", "name"]),
    readNestedString(order, ["locationTable", "name"]),
    readNestedString(order, ["locationTable", "number"]),
    readNestedString(order, ["seatInfo", "tableNumber"]),
  ].find(Boolean);
  if (direct) return direct;

  const seats = (order && typeof order === "object") ? (order as JsonObject).seats : null;
  if (Array.isArray(seats)) {
    for (const seat of seats) {
      const seatTable = readNestedString(seat, ["tableNumber"]) || readNestedString(seat, ["tableName"]);
      if (seatTable) return seatTable;
    }
  }
  return "";
}

export function extractChecksFromOrders(orders: unknown[]): { openChecks: SpotOnTableStatus[]; closedChecks: SpotOnTableStatus[] } {
  const openChecks: SpotOnTableStatus[] = [];
  const closedChecks: SpotOnTableStatus[] = [];

  for (const order of orders) {
    const orderTypeName =
      readNestedString(order, ["orderTypeName"])
      || readNestedString(order, ["orderType", "name"])
      || readNestedString(order, ["type", "name"]);
    if (!looksLikeDineIn(orderTypeName)) continue;

    const tableNumber = inferTableNumber(order);
    const orderId =
      readNestedString(order, ["id"])
      || readNestedString(order, ["orderId"])
      || readNestedString(order, ["uuid"]);
    const openedAt =
      readNestedString(order, ["createdAt"])
      || readNestedString(order, ["openedAt"]);
    const closedRaw =
      readNestedString(order, ["closedAt"])
      || readNestedString(order, ["closedDate"]);
    const check: SpotOnTableStatus = {
      tableNumber: tableNumber || "UNKNOWN",
      orderId: orderId || "",
      isOpen: !closedRaw,
      checkTotal: toMoneyString(readNestedString(order, ["totalAmount"]) || readNestedString(order, ["totals", "total"])),
      balanceDue: toMoneyString(readNestedString(order, ["balanceDueAmount"]) || readNestedString(order, ["totals", "balanceDue"])),
      openedAt: openedAt || "",
      closedAt: closedRaw || null,
      serverName:
        readNestedString(order, ["ownerInfo", "employeeName"])
        || readNestedString(order, ["employee", "name"])
        || "",
    };

    if (check.isOpen) openChecks.push(check);
    else closedChecks.push(check);
  }

  return { openChecks, closedChecks };
}

async function getSpotOnConfig() {
  const keys = ["spotonApiKey", "spotonLocationId", "spotonEnvironment"] as const;
  const rows = await prisma.setting.findMany({ where: { key: { in: [...keys] } } });
  const map = new Map(rows.map(row => [row.key, row.value]));
  const envValue = cleanString(map.get("spotonEnvironment")) || "production";
  const environment = envValue.toLowerCase() === "qa" ? "qa" : "production";
  return {
    apiKey: cleanString(map.get("spotonApiKey")),
    locationId: cleanString(map.get("spotonLocationId")),
    environment,
  };
}

export async function getSpotOnRuntimeConfig() {
  const cfg = await getSpotOnConfig();
  return {
    ...cfg,
    baseUrl: cfg.environment === "qa" ? QA_BASE_URL : PROD_BASE_URL,
  };
}

export async function fetchSpotOnOrdersWindow() {
  const cfg = await getSpotOnRuntimeConfig();
  if (!cfg.apiKey || !cfg.locationId) return { success: false as const, error: "SpotOn not configured" };

  const now = new Date();
  const updatedAtEnd = new Date(now.getTime() - 5 * 60 * 1000);
  const updatedAtStart = new Date(now.getTime() - 10 * 60 * 1000);
  const url = `${cfg.baseUrl}/locations/${encodeURIComponent(cfg.locationId)}/orders?updatedAtStart=${encodeURIComponent(toRFC3339NoMs(updatedAtStart))}&updatedAtEnd=${encodeURIComponent(toRFC3339NoMs(updatedAtEnd))}`;

  const response = await fetch(url, {
    method: "GET",
    headers: { "x-api-key": cfg.apiKey },
    cache: "no-store",
  });
  if (!response.ok) {
    const text = await response.text();
    return { success: false as const, error: text || `SpotOn request failed (${response.status})` };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { success: false as const, error: "SpotOn returned invalid JSON" };
  }

  return {
    success: true as const,
    orders: parseOrders(payload),
    timestamp: toRFC3339NoMs(now),
  };
}

export async function syncSpotOn(): Promise<SpotOnSyncResult> {
  const result = await fetchSpotOnOrdersWindow();
  if (!result.success) {
    return {
      success: false,
      error: result.error,
      timestamp: toRFC3339NoMs(new Date()),
      openChecks: [],
      closedChecks: [],
    };
  }

  const checks = extractChecksFromOrders(result.orders);
  return {
    success: true,
    timestamp: result.timestamp,
    openChecks: checks.openChecks,
    closedChecks: checks.closedChecks,
  };
}

export async function getTableMapping(): Promise<Map<string, number>> {
  const rows = await prisma.setting.findMany({
    where: { key: { startsWith: "spoton_table_" } },
  });
  const map = new Map<string, number>();
  for (const row of rows) {
    const spotOnTable = row.key.replace(/^spoton_table_/, "");
    const reservekitTableId = parseInt(row.value, 10);
    if (!spotOnTable || Number.isNaN(reservekitTableId)) continue;
    map.set(spotOnTable, reservekitTableId);
  }
  return map;
}

function extractTableCandidates(name: string): string[] {
  const value = cleanString(name).toUpperCase();
  if (!value) return [];
  const candidates = new Set<string>();

  const compact = value.replace(/\s+/g, "");
  if (/^[A-Z]+\d+$/.test(compact)) candidates.add(compact);

  const letterNum = value.match(/[A-Z]+\s*\d+/g) || [];
  for (const token of letterNum) candidates.add(token.replace(/\s+/g, ""));

  const nums = value.match(/\d+/g) || [];
  for (const n of nums) candidates.add(String(parseInt(n, 10)));

  return [...candidates].filter(Boolean);
}

export async function autoMatchTables(): Promise<SpotOnMatch[]> {
  const tables = await prisma.restaurantTable.findMany({ orderBy: { sortOrder: "asc" } });
  const matches: SpotOnMatch[] = [];
  const used = new Set<string>();

  for (const table of tables) {
    const candidates = extractTableCandidates(table.name);
    const picked = candidates.find(c => !used.has(c));
    if (!picked) continue;
    used.add(picked);
    await prisma.setting.upsert({
      where: { key: `spoton_table_${picked}` },
      update: { value: String(table.id) },
      create: { key: `spoton_table_${picked}`, value: String(table.id) },
    });
    matches.push({ spotOnTable: picked, reservekitTableId: table.id, tableName: table.name });
  }

  return matches;
}
