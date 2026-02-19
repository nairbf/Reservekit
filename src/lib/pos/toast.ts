import type {
  PosAdapter,
  PosBusinessHours,
  PosCredentials,
  PosMenuItem,
  PosSyncResult,
  PosTable,
} from "./types";

const COMING_SOON_MESSAGE = "Pending Toast partner approval";

function toastConfigured() {
  return Boolean(process.env.TOAST_CLIENT_ID && process.env.TOAST_CLIENT_SECRET);
}

export const toastAdapter: PosAdapter = {
  provider: "toast",
  displayName: "Toast",
  iconEmoji: "🍞",

  getAuthUrl(_redirectUri: string, _state: string) {
    if (!toastConfigured()) return "";
    // OAuth details vary by partner account configuration.
    // Keep disabled until partner credentials are fully enabled.
    return "";
  },

  async exchangeCode(_code: string, _redirectUri: string): Promise<PosCredentials> {
    throw new Error(COMING_SOON_MESSAGE);
  },

  async fetchMenu(_credentials: PosCredentials): Promise<PosMenuItem[]> {
    return [];
  },

  async fetchTables(_credentials: PosCredentials): Promise<PosTable[]> {
    return [];
  },

  async fetchBusinessHours(_credentials: PosCredentials): Promise<PosBusinessHours[]> {
    return [];
  },

  async fetchLocationName(_credentials: PosCredentials): Promise<string | null> {
    return null;
  },

  async sync(_credentials: PosCredentials): Promise<PosSyncResult> {
    return {
      provider: "toast",
      syncedAt: new Date().toISOString(),
      menuItems: [],
      tables: [],
      businessHours: [],
      locationName: null,
      error: COMING_SOON_MESSAGE,
    };
  },
};
