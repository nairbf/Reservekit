export type PosProvider = "square" | "toast" | "clover" | "spoton";

export interface PosCredentials {
  provider: PosProvider;
  accessToken: string;
  refreshToken?: string;
  locationId?: string;
  merchantId?: string;
  expiresAt?: string;
}

export interface PosMenuItem {
  externalId: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  imageUrl: string | null;
  available: boolean;
}

export interface PosTable {
  externalId: string;
  name: string;
  capacity: number | null;
  section: string | null;
}

export interface PosBusinessHours {
  day: string;
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
}

export interface PosSyncResult {
  provider: PosProvider;
  syncedAt: string;
  menuItems: PosMenuItem[];
  tables: PosTable[];
  businessHours: PosBusinessHours[];
  locationName: string | null;
  error: string | null;
}

export interface PosAdapter {
  provider: PosProvider;
  displayName: string;
  iconEmoji: string;

  getAuthUrl(redirectUri: string, state: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<PosCredentials>;
  refreshAccessToken?(credentials: PosCredentials): Promise<PosCredentials>;

  fetchMenu(credentials: PosCredentials): Promise<PosMenuItem[]>;
  fetchTables(credentials: PosCredentials): Promise<PosTable[]>;
  fetchBusinessHours(credentials: PosCredentials): Promise<PosBusinessHours[]>;
  fetchLocationName(credentials: PosCredentials): Promise<string | null>;

  sync(credentials: PosCredentials): Promise<PosSyncResult>;
}
