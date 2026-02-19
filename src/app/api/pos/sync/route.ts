import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getAvailableProviders,
  getPosAdapter,
  isPosProvider,
  type PosBusinessHours,
  type PosCredentials,
  type PosMenuItem,
  type PosProvider,
  type PosTable,
} from "@/lib/pos";

export const runtime = "nodejs";

const STORAGE_KEYS = {
  connectedProvider: "pos_connected_provider",
  lastSync: "pos_last_sync",
  error: "pos_sync_error",
  menuItems: "pos_menu_items",
  tables: "pos_tables",
  businessHours: "pos_business_hours",
  locationName: "pos_location_name",
  syncProvider: "pos_sync_provider",
} as const;

function credentialsKey(provider: PosProvider) {
  return `pos_credentials_${provider}`;
}

function providerIsAvailable(provider: PosProvider) {
  return getAvailableProviders().some((adapter) => adapter.provider === provider);
}

function safeParseArray<T>(raw: string | undefined): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function loadSettingMap() {
  const rows = await prisma.setting.findMany({
    where: {
      key: {
        in: [
          STORAGE_KEYS.connectedProvider,
          STORAGE_KEYS.lastSync,
          STORAGE_KEYS.error,
          STORAGE_KEYS.menuItems,
          STORAGE_KEYS.tables,
          STORAGE_KEYS.businessHours,
          STORAGE_KEYS.locationName,
          STORAGE_KEYS.syncProvider,
          credentialsKey("square"),
          credentialsKey("toast"),
          credentialsKey("clover"),
        ],
      },
    },
  });

  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;
  return map;
}

function resolveProvider(requested: unknown, settings: Record<string, string>): PosProvider | null {
  const fromBody = String(requested || "").trim();
  if (isPosProvider(fromBody) && providerIsAvailable(fromBody)) return fromBody;

  const connected = String(settings[STORAGE_KEYS.connectedProvider] || "").trim();
  if (isPosProvider(connected) && providerIsAvailable(connected)) return connected;

  for (const provider of ["square", "toast", "clover"] as const) {
    if (settings[credentialsKey(provider)]) return provider;
  }

  return null;
}

function parseCredentials(raw: string | undefined): PosCredentials | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PosCredentials;
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.provider || !parsed.accessToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function saveSettings(data: Record<string, string>) {
  for (const [key, value] of Object.entries(data)) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requirePermission("manage_integrations");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { provider?: string };
  const settings = await loadSettingMap();
  const provider = resolveProvider(body.provider, settings);
  if (!provider) {
    return NextResponse.json({ error: "No POS provider connected" }, { status: 400 });
  }

  const credentialValue = settings[credentialsKey(provider)];
  let credentials = parseCredentials(credentialValue);
  if (!credentials) {
    return NextResponse.json({ error: "Missing POS credentials" }, { status: 400 });
  }

  const adapter = getPosAdapter(provider);

  if (adapter.refreshAccessToken && credentials.expiresAt) {
    const expiresAtMs = new Date(credentials.expiresAt).getTime();
    const needsRefresh = Number.isFinite(expiresAtMs) && expiresAtMs - Date.now() < 1000 * 60 * 2;
    if (needsRefresh) {
      try {
        credentials = await adapter.refreshAccessToken(credentials);
        await saveSettings({ [credentialsKey(provider)]: JSON.stringify(credentials) });
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Failed to refresh POS token" },
          { status: 400 },
        );
      }
    }
  }

  const result = await adapter.sync(credentials);

  await saveSettings({
    [STORAGE_KEYS.connectedProvider]: provider,
    [STORAGE_KEYS.syncProvider]: provider,
    [STORAGE_KEYS.lastSync]: result.syncedAt,
    [STORAGE_KEYS.error]: result.error || "",
    [STORAGE_KEYS.menuItems]: JSON.stringify(result.menuItems),
    [STORAGE_KEYS.tables]: JSON.stringify(result.tables),
    [STORAGE_KEYS.businessHours]: JSON.stringify(result.businessHours),
    [STORAGE_KEYS.locationName]: result.locationName || "",
  });

  return NextResponse.json({
    ...result,
    counts: {
      menuItems: result.menuItems.length,
      tables: result.tables.length,
      businessHours: result.businessHours.length,
    },
  });
}

export async function GET() {
  try {
    await requirePermission("manage_integrations");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = await loadSettingMap();

  const providerRaw = settings[STORAGE_KEYS.connectedProvider] || settings[STORAGE_KEYS.syncProvider] || "";
  const provider = isPosProvider(providerRaw) ? providerRaw : null;
  const menuItems = safeParseArray<PosMenuItem>(settings[STORAGE_KEYS.menuItems]);
  const tables = safeParseArray<PosTable>(settings[STORAGE_KEYS.tables]);
  const businessHours = safeParseArray<PosBusinessHours>(settings[STORAGE_KEYS.businessHours]);

  const availability = {
    square: Boolean(process.env.SQUARE_APP_ID && process.env.SQUARE_APP_SECRET),
    toast: Boolean(process.env.TOAST_CLIENT_ID && process.env.TOAST_CLIENT_SECRET),
    clover: Boolean(process.env.CLOVER_APP_ID && process.env.CLOVER_APP_SECRET),
  };

  return NextResponse.json({
    provider,
    connected: Boolean(provider && settings[credentialsKey(provider)]),
    lastSync: settings[STORAGE_KEYS.lastSync] || null,
    locationName: settings[STORAGE_KEYS.locationName] || null,
    error: settings[STORAGE_KEYS.error] || null,
    menuItems,
    tables,
    businessHours,
    counts: {
      menuItems: menuItems.length,
      tables: tables.length,
      businessHours: businessHours.length,
    },
    credentialsPresent: {
      square: Boolean(settings[credentialsKey("square")]),
      toast: Boolean(settings[credentialsKey("toast")]),
      clover: Boolean(settings[credentialsKey("clover")]),
    },
    availability,
  });
}

export async function DELETE(req: NextRequest) {
  try {
    await requirePermission("manage_integrations");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { provider?: string };
  const settings = await loadSettingMap();
  const provider = resolveProvider(body.provider, settings);
  if (!provider) {
    return NextResponse.json({ error: "No POS provider selected" }, { status: 400 });
  }

  await prisma.setting.deleteMany({
    where: {
      key: {
        in: [
          credentialsKey(provider),
          STORAGE_KEYS.connectedProvider,
          STORAGE_KEYS.syncProvider,
          STORAGE_KEYS.lastSync,
          STORAGE_KEYS.error,
          STORAGE_KEYS.menuItems,
          STORAGE_KEYS.tables,
          STORAGE_KEYS.businessHours,
          STORAGE_KEYS.locationName,
        ],
      },
    },
  });

  return NextResponse.json({ ok: true, provider });
}
