import { prisma } from "@/lib/db";

export interface LoyaltyConsentRecord {
  phone: string;
  optedIn: boolean;
  updatedAt: string;
  source: string;
}

function getKey(phone: string): string {
  return `loyalty_phone_${phone}`;
}

export function normalizeLoyaltyPhone(input: string): string | null {
  const digits = String(input || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

function parseConsent(phone: string, raw: string): LoyaltyConsentRecord | null {
  try {
    const parsed = JSON.parse(raw) as Partial<LoyaltyConsentRecord>;
    if (typeof parsed.optedIn !== "boolean") return null;
    return {
      phone,
      optedIn: parsed.optedIn,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
      source: typeof parsed.source === "string" ? parsed.source : "widget",
    };
  } catch {
    if (raw === "true" || raw === "false") {
      return {
        phone,
        optedIn: raw === "true",
        updatedAt: new Date().toISOString(),
        source: "legacy",
      };
    }
    return null;
  }
}

export async function getLoyaltyConsent(phoneInput: string): Promise<LoyaltyConsentRecord | null> {
  const phone = normalizeLoyaltyPhone(phoneInput);
  if (!phone) return null;
  const row = await prisma.setting.findUnique({ where: { key: getKey(phone) } });
  if (!row) return null;
  return parseConsent(phone, row.value);
}

export async function saveLoyaltyConsent(phoneInput: string, optedIn: boolean, source = "widget"): Promise<LoyaltyConsentRecord | null> {
  const phone = normalizeLoyaltyPhone(phoneInput);
  if (!phone) return null;
  const record: LoyaltyConsentRecord = {
    phone,
    optedIn,
    updatedAt: new Date().toISOString(),
    source,
  };
  await prisma.setting.upsert({
    where: { key: getKey(phone) },
    update: { value: JSON.stringify(record) },
    create: { key: getKey(phone), value: JSON.stringify(record) },
  });
  return record;
}
