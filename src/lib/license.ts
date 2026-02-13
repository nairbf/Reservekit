import { prisma } from "./db";
import { getSession } from "./auth";

const ADMIN_API_URL = process.env.ADMIN_API_URL || "https://admin.reservesit.com";

const PREFIXES: Record<string, string> = {
  sms: "RS-SMS-",
  floorplan: "RS-FLR-",
  reports: "RS-RPT-",
  guesthistory: "RS-GST-",
  pos: "RS-POS-",
  multilocation: "RS-MLT-",
  events: "RS-EVT-",
  eventticketing: "RS-EVT-",
  expressdining: "RS-XDN-",
};

const FEATURE_KEYS: Record<string, string> = {
  sms: "feature_sms",
  floorplan: "feature_floorplan",
  reports: "feature_reporting",
  guesthistory: "feature_guest_history",
  eventticketing: "feature_event_ticketing",
  events: "feature_event_ticketing",
};

export interface LicenseInfo {
  valid: boolean;
  status: "ACTIVE" | "SUSPENDED" | "TRIAL" | "CANCELLED";
  plan: "CORE" | "SERVICE_PRO" | "FULL_SUITE";
  restaurantName: string;
  features: {
    sms: boolean;
    floorPlan: boolean;
    reporting: boolean;
    guestHistory: boolean;
    eventTicketing: boolean;
  };
  expiresAt: string | null;
}

async function isAdminSession(): Promise<boolean> {
  try {
    const session = await getSession();
    return session?.role === "admin" || session?.role === "superadmin";
  } catch {
    return false;
  }
}

function featureSettingsPayload(licenseInfo: LicenseInfo): Record<string, string> {
  return {
    feature_sms: licenseInfo.features.sms.toString(),
    feature_floorplan: licenseInfo.features.floorPlan.toString(),
    feature_reporting: licenseInfo.features.reporting.toString(),
    feature_guest_history: licenseInfo.features.guestHistory.toString(),
    feature_event_ticketing: licenseInfo.features.eventTicketing.toString(),
    license_status: licenseInfo.status,
    license_plan: licenseInfo.plan,
    license_valid: licenseInfo.valid.toString(),
    license_last_check: new Date().toISOString(),
  };
}

export async function validateLicense(licenseKey: string): Promise<LicenseInfo | null> {
  const key = String(licenseKey || "").trim();
  if (!key) return null;

  try {
    const res = await fetch(`${ADMIN_API_URL}/api/license/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey: key }),
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });

    if (!res.ok) return null;
    return (await res.json()) as LicenseInfo;
  } catch {
    return null;
  }
}

export async function syncLicenseToSettings(
  prismaLike: {
    setting: {
      upsert: (args: {
        where: { key: string };
        create: { key: string; value: string };
        update: { value: string };
      }) => Promise<unknown>;
    };
  },
  licenseInfo: LicenseInfo,
) {
  const payload = featureSettingsPayload(licenseInfo);
  for (const [key, value] of Object.entries(payload)) {
    await prismaLike.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }
}

export async function isModuleActive(module: string, options?: { allowAdminBypass?: boolean }): Promise<boolean> {
  const allowAdminBypass = options?.allowAdminBypass ?? true;

  const featureSettingKey = FEATURE_KEYS[module];
  if (featureSettingKey) {
    const featureSetting = await prisma.setting.findUnique({ where: { key: featureSettingKey } });
    if (featureSetting) return featureSetting.value === "true";
  }

  const row = await prisma.setting.findUnique({ where: { key: `license_${module}` } });
  const value = String(row?.value || "").toUpperCase();
  const prefix = PREFIXES[module];
  if (!prefix) return false;

  if (value.startsWith(prefix)) {
    const suffix = value.slice(prefix.length);
    if (suffix.length === 8 && /^[A-Z0-9]+$/.test(suffix)) return true;
  }

  if (allowAdminBypass) {
    return isAdminSession();
  }

  return false;
}
