import { prisma } from "@/lib/db";

export async function isFeatureEnabled(feature: string): Promise<boolean> {
  const setting = await prisma.setting.findUnique({ where: { key: `feature_${feature}` } });
  return setting?.value === "true";
}

export async function getEnabledFeatures(): Promise<Record<string, boolean>> {
  const features = ["sms", "floorplan", "reporting", "guest_history", "event_ticketing"];
  const settings = await prisma.setting.findMany({
    where: { key: { in: features.map((feature) => `feature_${feature}`) } },
  });

  const map = new Map(settings.map((row) => [row.key, row.value]));
  const result: Record<string, boolean> = {};

  for (const feature of features) {
    result[feature] = map.get(`feature_${feature}`) === "true";
  }

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
