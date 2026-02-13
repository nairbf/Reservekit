import path from "path";
import Database from "better-sqlite3";

export const ADDON_SETTING_MAP = {
  addonSms: "feature_sms",
  addonFloorPlan: "feature_floorplan",
  addonReporting: "feature_reporting",
  addonGuestHistory: "feature_guest_history",
  addonEventTicketing: "feature_event_ticketing",
} as const;

export type AddonKey = keyof typeof ADDON_SETTING_MAP;

export interface AddonState {
  addonSms: boolean;
  addonFloorPlan: boolean;
  addonReporting: boolean;
  addonGuestHistory: boolean;
  addonEventTicketing: boolean;
}

export function addonToSettingKey(addon: AddonKey): string {
  return ADDON_SETTING_MAP[addon];
}

export function resolveRestaurantDbPath(slug: string, existingDbPath?: string | null) {
  if (existingDbPath) return existingDbPath;
  const root = process.env.RESTAURANT_DB_ROOT || "/home/reservesit/customers";
  return path.join(root, slug, "reservekit.db");
}

export function syncAddonsToRestaurantDb(slug: string, addons: AddonState, existingDbPath?: string | null) {
  const dbPath = resolveRestaurantDbPath(slug, existingDbPath);
  const db = new Database(dbPath);

  try {
    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'Setting' LIMIT 1")
      .get() as { name?: string } | undefined;

    if (!table?.name) {
      throw new Error("Setting table not found in restaurant database");
    }

    const upsert = db.prepare(`
      INSERT INTO Setting (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    const txn = db.transaction((entries: Array<[AddonKey, boolean]>) => {
      for (const [addon, enabled] of entries) {
        upsert.run(addonToSettingKey(addon), enabled ? "true" : "false");
      }
    });

    const pairs = Object.entries(addons) as Array<[AddonKey, boolean]>;
    txn(pairs);

    return {
      dbPath,
      syncedKeys: pairs.map(([addon]) => addonToSettingKey(addon)),
    };
  } finally {
    db.close();
  }
}
