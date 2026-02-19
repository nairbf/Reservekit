import { prisma } from "@/lib/db";

const FEATURE_ALIASES: Record<string, string> = {
  floor_plan: "floorplan",
  floorPlan: "floorplan",
};

const FEATURE_KEYS = ["sms", "floorplan", "reporting", "guest_history", "event_ticketing"] as const;

function normalizeFeature(feature: string) {
  const value = String(feature || "").trim();
  return FEATURE_ALIASES[value] || value;
}

export async function isFeatureEnabled(feature: string): Promise<boolean> {
  const normalized = normalizeFeature(feature);
  const setting = await prisma.setting.findUnique({ where: { key: `feature_${normalized}` } });
  return setting?.value === "true";
}

export async function getEnabledFeatures(): Promise<Record<string, boolean>> {
  const settings = await prisma.setting.findMany({
    where: { key: { in: FEATURE_KEYS.map((feature) => `feature_${feature}`) } },
  });

  const map = new Map(settings.map((row) => [row.key, row.value]));
  const result: Record<string, boolean> = {};

  for (const feature of FEATURE_KEYS) {
    result[feature] = map.get(`feature_${feature}`) === "true";
  }

  // Backward-compatible aliases used in older UI/builds.
  result.floor_plan = result.floorplan;
  result.floorPlan = result.floorplan;

  return result;
}

export async function getLicenseInfo() {
  const keys = ["license_key", "license_status", "license_plan", "license_valid", "license_last_check"];
  const settings = await prisma.setting.findMany({ where: { key: { in: keys } } });
  const map = Object.fromEntries(settings.map((setting) => [setting.key, setting.value]));

  return {
    key: map.license_key || null,
    status: map.license_status || "UNKNOWN",
    plan: map.license_plan || "CORE",
    valid: map.license_valid === "true",
    lastCheck: map.license_last_check || null,
  };
}
