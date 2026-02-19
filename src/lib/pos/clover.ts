import type {
  PosAdapter,
  PosBusinessHours,
  PosCredentials,
  PosMenuItem,
  PosSyncResult,
  PosTable,
} from "./types";

const CLOVER_OAUTH_AUTHORIZE = "https://www.clover.com/oauth/authorize";
const CLOVER_OAUTH_TOKEN = "https://api.clover.com/oauth/token";
const CLOVER_API = "https://api.clover.com/v3";
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 10_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

function toQuery(params: Record<string, string>) {
  const query = new URLSearchParams(params);
  return query.toString();
}

function normalizeTime(value: unknown): string | null {
  const str = typeof value === "string" ? value : "";
  if (!str) return null;
  if (str.includes(":")) return str.slice(0, 5);
  return null;
}

async function cloverGet(path: string, accessToken: string) {
  const response = await fetchWithTimeout(`${CLOVER_API}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Clover API error: ${response.status}`);
  }

  return response.json();
}

function requireMerchantId(credentials: PosCredentials): string {
  const merchantId = credentials.merchantId || credentials.locationId;
  if (!merchantId) throw new Error("Missing Clover merchant id");
  return merchantId;
}

export const cloverAdapter: PosAdapter = {
  provider: "clover",
  displayName: "Clover",
  iconEmoji: "🍀",

  getAuthUrl(redirectUri: string, state: string) {
    const appId = process.env.CLOVER_APP_ID || "";
    if (!appId) return "";
    const query = toQuery({
      client_id: appId,
      response_type: "code",
      redirect_uri: redirectUri,
      state,
    });
    return `${CLOVER_OAUTH_AUTHORIZE}?${query}`;
  },

  async exchangeCode(code: string, redirectUri: string): Promise<PosCredentials> {
    const appId = process.env.CLOVER_APP_ID || "";
    const appSecret = process.env.CLOVER_APP_SECRET || "";
    if (!appId || !appSecret) throw new Error("Clover credentials are not configured");

    const body = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });

    const response = await fetchWithTimeout(CLOVER_OAUTH_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const data = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      merchant_id?: string;
      expires_in?: number;
      error_description?: string;
      error?: string;
    };

    if (!response.ok || !data.access_token) {
      throw new Error(data.error_description || data.error || "Clover OAuth failed");
    }

    const expiresAt = data.expires_in
      ? new Date(Date.now() + Math.max(0, Math.trunc(Number(data.expires_in))) * 1000).toISOString()
      : undefined;

    return {
      provider: "clover",
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      merchantId: data.merchant_id,
      locationId: data.merchant_id,
      expiresAt,
    };
  },

  async refreshAccessToken(credentials: PosCredentials): Promise<PosCredentials> {
    const appId = process.env.CLOVER_APP_ID || "";
    const appSecret = process.env.CLOVER_APP_SECRET || "";
    if (!appId || !appSecret) throw new Error("Clover credentials are not configured");
    if (!credentials.refreshToken) throw new Error("Missing Clover refresh token");

    const body = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      refresh_token: credentials.refreshToken,
      grant_type: "refresh_token",
    });

    const response = await fetchWithTimeout(CLOVER_OAUTH_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const data = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error_description?: string;
      error?: string;
    };

    if (!response.ok || !data.access_token) {
      throw new Error(data.error_description || data.error || "Clover token refresh failed");
    }

    const expiresAt = data.expires_in
      ? new Date(Date.now() + Math.max(0, Math.trunc(Number(data.expires_in))) * 1000).toISOString()
      : credentials.expiresAt;

    return {
      ...credentials,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || credentials.refreshToken,
      expiresAt,
    };
  },

  async fetchMenu(credentials: PosCredentials): Promise<PosMenuItem[]> {
    const merchantId = requireMerchantId(credentials);
    const data = await cloverGet(`/merchants/${encodeURIComponent(merchantId)}/items`, credentials.accessToken);
    const elements = Array.isArray(data?.elements) ? data.elements : [];

    return elements.map((item: Record<string, unknown>) => ({
      externalId: String(item.id || ""),
      name: String(item.name || "Untitled"),
      description: item.description ? String(item.description) : null,
      price: Number.isFinite(Number(item.price)) ? Math.max(0, Math.trunc(Number(item.price))) : 0,
      category: item.category && typeof item.category === "object" && (item.category as { name?: string }).name
        ? String((item.category as { name?: string }).name)
        : null,
      imageUrl: item.modifiedTime && typeof item.modifiedTime === "number"
        ? `https://api.clover.com/v3/merchants/${encodeURIComponent(merchantId)}/items/${encodeURIComponent(String(item.id || ""))}/image`
        : null,
      available: item.hidden ? !Boolean(item.hidden) : true,
    }));
  },

  async fetchTables(credentials: PosCredentials): Promise<PosTable[]> {
    const merchantId = requireMerchantId(credentials);
    const data = await cloverGet(`/merchants/${encodeURIComponent(merchantId)}/tables`, credentials.accessToken);
    const elements = Array.isArray(data?.elements) ? data.elements : [];

    return elements.map((table: Record<string, unknown>) => ({
      externalId: String(table.id || ""),
      name: String(table.name || "Table"),
      capacity: Number.isFinite(Number(table.minCapacity))
        ? Math.max(0, Math.trunc(Number(table.minCapacity)))
        : null,
      section: table.section && typeof table.section === "object" && (table.section as { name?: string }).name
        ? String((table.section as { name?: string }).name)
        : null,
    }));
  },

  async fetchBusinessHours(credentials: PosCredentials): Promise<PosBusinessHours[]> {
    const merchantId = requireMerchantId(credentials);
    const data = await cloverGet(`/merchants/${encodeURIComponent(merchantId)}/hours`, credentials.accessToken);

    const periods: Record<string, { start: string | null; end: string | null }> = {};
    const rawPeriods = Array.isArray(data?.periods)
      ? data.periods
      : Array.isArray(data?.elements)
        ? data.elements
        : [];

    for (const row of rawPeriods) {
      const dayRaw = String((row as Record<string, unknown>).day || (row as Record<string, unknown>).dayOfWeek || "").toLowerCase();
      if (!dayRaw) continue;
      periods[dayRaw] = {
        start: normalizeTime((row as Record<string, unknown>).start || (row as Record<string, unknown>).openTime),
        end: normalizeTime((row as Record<string, unknown>).end || (row as Record<string, unknown>).closeTime),
      };
    }

    return DAYS.map((day) => {
      const key = day.toLowerCase();
      const period = periods[key] || periods[key.slice(0, 3)];
      return {
        day,
        openTime: period?.start || null,
        closeTime: period?.end || null,
        isClosed: !period?.start,
      };
    });
  },

  async fetchLocationName(credentials: PosCredentials): Promise<string | null> {
    const merchantId = requireMerchantId(credentials);
    const data = await cloverGet(`/merchants/${encodeURIComponent(merchantId)}`, credentials.accessToken);
    return data?.name ? String(data.name) : null;
  },

  async sync(credentials: PosCredentials): Promise<PosSyncResult> {
    try {
      const [menuItems, tables, businessHours, locationName] = await Promise.all([
        this.fetchMenu(credentials),
        this.fetchTables(credentials),
        this.fetchBusinessHours(credentials),
        this.fetchLocationName(credentials),
      ]);

      return {
        provider: "clover",
        syncedAt: new Date().toISOString(),
        menuItems,
        tables,
        businessHours,
        locationName,
        error: null,
      };
    } catch (error) {
      return {
        provider: "clover",
        syncedAt: new Date().toISOString(),
        menuItems: [],
        tables: [],
        businessHours: [],
        locationName: null,
        error: error instanceof Error ? error.message : "Clover sync failed",
      };
    }
  },
};
