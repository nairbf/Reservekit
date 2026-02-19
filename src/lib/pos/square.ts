import type {
  PosAdapter,
  PosBusinessHours,
  PosCredentials,
  PosMenuItem,
  PosSyncResult,
  PosTable,
} from "./types";

const SQUARE_BASE = "https://connect.squareup.com/v2";
const SQUARE_OAUTH = "https://connect.squareup.com/oauth2";
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

async function squareGet(path: string, accessToken: string) {
  const response = await fetchWithTimeout(`${SQUARE_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Square-Version": "2024-01-18",
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Square API error: ${response.status}`);
  }

  return response.json();
}

function normalizeTime(value: unknown): string | null {
  const str = typeof value === "string" ? value : "";
  if (!str) return null;
  return str.slice(0, 5);
}

export const squareAdapter: PosAdapter = {
  provider: "square",
  displayName: "Square",
  iconEmoji: "🟩",

  getAuthUrl(redirectUri: string, state: string) {
    const clientId = process.env.SQUARE_APP_ID || "";
    if (!clientId) return "";
    const scopes = ["ITEMS_READ", "MERCHANT_PROFILE_READ", "ORDERS_READ"].join("+");
    return `${SQUARE_OAUTH}/authorize?client_id=${encodeURIComponent(clientId)}&scope=${scopes}&session=false&state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  },

  async exchangeCode(code: string, redirectUri: string): Promise<PosCredentials> {
    const response = await fetchWithTimeout(`${SQUARE_OAUTH}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.SQUARE_APP_ID,
        client_secret: process.env.SQUARE_APP_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      expires_at?: string;
      merchant_id?: string;
      message?: string;
      errors?: Array<{ detail?: string }>;
    };

    if (!response.ok || !data.access_token) {
      const detail = data.errors?.[0]?.detail || data.message || "Square OAuth failed";
      throw new Error(detail);
    }

    const locations = await squareGet("/locations", data.access_token);
    const locationId = locations?.locations?.[0]?.id || "";

    return {
      provider: "square",
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      locationId,
      merchantId: data.merchant_id,
      expiresAt: data.expires_at,
    };
  },

  async refreshAccessToken(credentials: PosCredentials): Promise<PosCredentials> {
    if (!credentials.refreshToken) throw new Error("Missing Square refresh token");

    const response = await fetchWithTimeout(`${SQUARE_OAUTH}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.SQUARE_APP_ID,
        client_secret: process.env.SQUARE_APP_SECRET,
        refresh_token: credentials.refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const data = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      expires_at?: string;
      errors?: Array<{ detail?: string }>;
    };

    if (!response.ok || !data.access_token) {
      throw new Error(data.errors?.[0]?.detail || "Square token refresh failed");
    }

    return {
      ...credentials,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || credentials.refreshToken,
      expiresAt: data.expires_at,
    };
  },

  async fetchMenu(credentials: PosCredentials): Promise<PosMenuItem[]> {
    const data = await squareGet("/catalog/list?types=ITEM", credentials.accessToken);
    const items: PosMenuItem[] = [];

    for (const obj of data?.objects || []) {
      if (obj?.type !== "ITEM") continue;
      const itemData = obj?.item_data;
      if (!itemData) continue;

      const variation = itemData.variations?.[0]?.item_variation_data;
      const amount = Number(variation?.price_money?.amount || 0);

      items.push({
        externalId: String(obj.id || ""),
        name: String(itemData.name || "Untitled"),
        description: itemData.description ? String(itemData.description) : null,
        price: Number.isFinite(amount) ? Math.max(0, Math.trunc(amount)) : 0,
        category: itemData.category_data?.name ? String(itemData.category_data.name) : null,
        imageUrl: null,
        available: !Boolean(itemData.is_deleted),
      });
    }

    return items;
  },

  async fetchTables(_credentials: PosCredentials): Promise<PosTable[]> {
    return [];
  },

  async fetchBusinessHours(credentials: PosCredentials): Promise<PosBusinessHours[]> {
    if (!credentials.locationId) return DAYS.map((day) => ({ day, openTime: null, closeTime: null, isClosed: true }));

    const data = await squareGet(`/locations/${encodeURIComponent(credentials.locationId)}`, credentials.accessToken);
    const periods = data?.location?.business_hours?.periods || [];

    return DAYS.map((day) => {
      const period = periods.find((entry: { day_of_week?: string }) => entry?.day_of_week === day.toUpperCase());
      return {
        day,
        openTime: normalizeTime(period?.start_local_time),
        closeTime: normalizeTime(period?.end_local_time),
        isClosed: !period,
      };
    });
  },

  async fetchLocationName(credentials: PosCredentials): Promise<string | null> {
    if (!credentials.locationId) return null;
    const data = await squareGet(`/locations/${encodeURIComponent(credentials.locationId)}`, credentials.accessToken);
    return data?.location?.name ? String(data.location.name) : null;
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
        provider: "square",
        syncedAt: new Date().toISOString(),
        menuItems,
        tables,
        businessHours,
        locationName,
        error: null,
      };
    } catch (error) {
      return {
        provider: "square",
        syncedAt: new Date().toISOString(),
        menuItems: [],
        tables: [],
        businessHours: [],
        locationName: null,
        error: error instanceof Error ? error.message : "Square sync failed",
      };
    }
  },
};
