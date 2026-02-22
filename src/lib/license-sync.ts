import { prisma } from "@/lib/db";
import { syncLicenseToSettings, validateLicense, type LicenseInfo } from "@/lib/license";

const ADMIN_API_URL = process.env.ADMIN_API_URL || "https://admin.reservesit.com";

const FEATURE_KEYS = [
  "feature_sms",
  "feature_floorplan",
  "feature_reporting",
  "feature_guest_history",
  "feature_event_ticketing",
] as const;

type AdminCustomerSnapshot = {
  plan?: "CORE" | "SERVICE_PRO" | "FULL_SUITE";
  status?: "ACTIVE" | "SUSPENDED" | "TRIAL" | "CANCELLED";
  licenseKey?: string;
  addonSms?: boolean;
  addonFloorPlan?: boolean;
  addonReporting?: boolean;
  addonGuestHistory?: boolean;
  addonEventTicketing?: boolean;
};

function planFeatures(plan: string) {
  if (plan === "FULL_SUITE") {
    return {
      sms: true,
      floorPlan: true,
      reporting: true,
      guestHistory: true,
      eventTicketing: true,
    };
  }

  if (plan === "SERVICE_PRO") {
    return {
      sms: true,
      floorPlan: true,
      reporting: true,
      guestHistory: false,
      eventTicketing: false,
    };
  }

  return {
    sms: false,
    floorPlan: false,
    reporting: false,
    guestHistory: false,
    eventTicketing: false,
  };
}

function isLicenseSnapshotMissing(map: Record<string, string>) {
  if (!map.license_plan || !map.license_status) return true;
  return FEATURE_KEYS.some((key) => !(key in map));
}

function createLicenseInfoFromAdmin(snapshot: AdminCustomerSnapshot): LicenseInfo | null {
  const plan = String(snapshot.plan || "CORE").toUpperCase();
  const status = String(snapshot.status || "UNKNOWN").toUpperCase();

  if (!["CORE", "SERVICE_PRO", "FULL_SUITE"].includes(plan)) return null;
  if (!["ACTIVE", "SUSPENDED", "TRIAL", "CANCELLED"].includes(status)) return null;

  const features = planFeatures(plan);
  if (snapshot.addonSms) features.sms = true;
  if (snapshot.addonFloorPlan) features.floorPlan = true;
  if (snapshot.addonReporting) features.reporting = true;
  if (snapshot.addonGuestHistory) features.guestHistory = true;
  if (snapshot.addonEventTicketing) features.eventTicketing = true;

  return {
    valid: status === "ACTIVE" || status === "TRIAL",
    status: status as LicenseInfo["status"],
    plan: plan as LicenseInfo["plan"],
    restaurantName: "",
    expiresAt: null,
    features,
  };
}

async function fetchCustomerSnapshot(email: string): Promise<AdminCustomerSnapshot | null> {
  const secret = process.env.PLATFORM_WEBHOOK_SECRET?.trim();
  if (!secret) return null;

  try {
    const url = `${ADMIN_API_URL}/api/auth/customer-info?email=${encodeURIComponent(email)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: { "x-webhook-secret": secret },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });

    if (!response.ok) return null;
    return (await response.json()) as AdminCustomerSnapshot;
  } catch {
    return null;
  }
}

export async function ensureLicenseSettings(email: string, currentSettings?: Record<string, string>) {
  const map = currentSettings ?? Object.fromEntries((await prisma.setting.findMany()).map((row) => [row.key, row.value]));
  if (!isLicenseSnapshotMissing(map)) return;

  const currentLicenseKey = String(map.license_key || "").trim();

  try {
    if (currentLicenseKey) {
      const info = await validateLicense(currentLicenseKey);
      if (info) {
        await syncLicenseToSettings(prisma, info);
        return;
      }
    }

    const snapshot = await fetchCustomerSnapshot(email);
    if (!snapshot) return;

    const derived = createLicenseInfoFromAdmin(snapshot);
    if (!derived) return;

    await syncLicenseToSettings(prisma, derived);
    if (snapshot.licenseKey) {
      await prisma.setting.upsert({
        where: { key: "license_key" },
        create: { key: "license_key", value: snapshot.licenseKey },
        update: { value: snapshot.licenseKey },
      });
    }
  } catch (error) {
    console.error("[LICENSE SYNC] Failed to sync license settings", error);
  }
}
