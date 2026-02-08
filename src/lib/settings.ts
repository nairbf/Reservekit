import { prisma } from "./db";

export type WeekdayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

export interface DailyScheduleConfig {
  isClosed: boolean;
  openTime: string;
  closeTime: string;
  maxCovers: number | null;
}

export type WeeklyScheduleConfig = Record<WeekdayKey, DailyScheduleConfig>;

export interface SpecialDepositRule {
  enabled: boolean;
  label: string;
  requiresDeposit: boolean;
  amount: number;
  minParty: number;
  message: string;
}

export interface AppSettings {
  restaurantName: string;
  timezone: string;
  openTime: string;
  closeTime: string;
  slotInterval: number;
  lastSeatingBufferMin: number;
  maxCoversPerSlot: number;
  maxPartySize: number;
  diningDurations: Record<string, number>;
  depositsEnabled: boolean;
  depositAmount: number;
  depositMinParty: number;
  depositMessage: string;
  reserveHeading: string;
  reserveSubheading: string;
  reserveConfirmationMessage: string;
  reserveRequestDisclaimer: string;
  reserveRequestPlaceholder: string;
  reserveRequestSamples: string[];
  loyaltyOptInEnabled: boolean;
  loyaltyProgramName: string;
  loyaltyOptInMessage: string;
  loyaltyOptInLabel: string;
  weeklySchedule: WeeklyScheduleConfig;
  specialDepositRules: Record<string, SpecialDepositRule>;
}

const WEEKDAY_KEYS: WeekdayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function parseJson<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toInt(value: string | number | null | undefined, fallback: number): number {
  const parsed = typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.trunc(parsed);
}

function toFloat(value: string | number | null | undefined, fallback: number): number {
  const parsed = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function normalizeWeekdayKey(raw: string): WeekdayKey | null {
  const v = raw.trim().toLowerCase();
  if (v === "sun" || v === "sunday" || v === "0") return "sun";
  if (v === "mon" || v === "monday" || v === "1") return "mon";
  if (v === "tue" || v === "tuesday" || v === "2") return "tue";
  if (v === "wed" || v === "wednesday" || v === "3") return "wed";
  if (v === "thu" || v === "thursday" || v === "4") return "thu";
  if (v === "fri" || v === "friday" || v === "5") return "fri";
  if (v === "sat" || v === "saturday" || v === "6") return "sat";
  return null;
}

function defaultWeeklySchedule(openTime: string, closeTime: string, maxCoversPerSlot: number): WeeklyScheduleConfig {
  return {
    sun: { isClosed: false, openTime, closeTime, maxCovers: maxCoversPerSlot },
    mon: { isClosed: false, openTime, closeTime, maxCovers: maxCoversPerSlot },
    tue: { isClosed: false, openTime, closeTime, maxCovers: maxCoversPerSlot },
    wed: { isClosed: false, openTime, closeTime, maxCovers: maxCoversPerSlot },
    thu: { isClosed: false, openTime, closeTime, maxCovers: maxCoversPerSlot },
    fri: { isClosed: false, openTime, closeTime, maxCovers: maxCoversPerSlot },
    sat: { isClosed: false, openTime, closeTime, maxCovers: maxCoversPerSlot },
  };
}

function parseWeeklySchedule(raw: string | undefined, fallback: WeeklyScheduleConfig): WeeklyScheduleConfig {
  const parsed = parseJson<Record<string, Partial<DailyScheduleConfig>>>(raw, {});
  const out: WeeklyScheduleConfig = { ...fallback };
  for (const [k, v] of Object.entries(parsed)) {
    const key = normalizeWeekdayKey(k);
    if (!key) continue;
    out[key] = {
      isClosed: Boolean(v?.isClosed),
      openTime: String(v?.openTime || fallback[key].openTime),
      closeTime: String(v?.closeTime || fallback[key].closeTime),
      maxCovers: typeof v?.maxCovers === "number" && Number.isFinite(v.maxCovers) ? Math.max(1, Math.trunc(v.maxCovers)) : fallback[key].maxCovers,
    };
  }
  return out;
}

function parseSpecialDepositRules(
  raw: string | undefined,
  defaults: { amount: number; minParty: number; message: string },
): Record<string, SpecialDepositRule> {
  const fallback: Record<string, SpecialDepositRule> = {};
  const parsed = parseJson<unknown>(raw, fallback);

  const assign = (date: string, rule: Partial<SpecialDepositRule>) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    fallback[date] = {
      enabled: rule.enabled !== false,
      label: String(rule.label || ""),
      requiresDeposit: Boolean(rule.requiresDeposit),
      amount: Math.max(0, toFloat(rule.amount, defaults.amount)),
      minParty: Math.max(1, toInt(rule.minParty, defaults.minParty)),
      message: String(rule.message || defaults.message),
    };
  };

  if (Array.isArray(parsed)) {
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const obj = entry as Record<string, unknown>;
      const date = String(obj.date || "");
      assign(date, obj as Partial<SpecialDepositRule>);
    }
    return fallback;
  }

  if (parsed && typeof parsed === "object") {
    for (const [date, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      assign(date, value as Partial<SpecialDepositRule>);
    }
  }

  return fallback;
}

export async function getSettings(): Promise<AppSettings> {
  const rows = await prisma.setting.findMany({
    where: {
      NOT: [
        { key: { startsWith: "pos_status_" } },
        { key: { startsWith: "spoton_table_" } },
        { key: { startsWith: "loyalty_phone_" } },
      ],
    },
  });
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;

  const openTime = map.openTime || "17:00";
  const closeTime = map.closeTime || "22:00";
  const maxCoversPerSlot = toInt(map.maxCoversPerSlot, 40);
  const depositMessage = map.depositMessage || "A refundable deposit may be required to hold your table.";
  const depositAmount = Math.max(0, toFloat(map.depositAmount, 0));
  const depositMinParty = Math.max(1, toInt(map.depositMinParty, 2));
  const reserveRequestSamplesRaw = map.reserveRequestSamples || "Birthday celebration,Window seat,High chair";
  const reserveRequestSamples = reserveRequestSamplesRaw.split(",").map(s => s.trim()).filter(Boolean);
  const weeklyFallback = defaultWeeklySchedule(openTime, closeTime, maxCoversPerSlot);

  return {
    restaurantName: map.restaurantName || "Restaurant",
    timezone: map.timezone || "America/New_York",
    openTime,
    closeTime,
    slotInterval: Math.max(5, toInt(map.slotInterval, 30)),
    lastSeatingBufferMin: Math.max(0, toInt(map.lastSeatingBufferMin, 90)),
    maxCoversPerSlot,
    maxPartySize: Math.max(1, toInt(map.maxPartySize, 8)),
    diningDurations: parseJson<Record<string, number>>(map.diningDurations, {}),
    depositsEnabled: map.depositsEnabled === "true",
    depositAmount,
    depositMinParty,
    depositMessage,
    reserveHeading: map.reserveHeading || "Reserve a Table",
    reserveSubheading: map.reserveSubheading || "Choose your date, time, and party size.",
    reserveConfirmationMessage: map.reserveConfirmationMessage || "We'll contact you shortly to confirm.",
    reserveRequestDisclaimer: map.reserveRequestDisclaimer || "Your request will be reviewed and confirmed shortly.",
    reserveRequestPlaceholder: map.reserveRequestPlaceholder || "e.g., Birthday dinner, window seat, stroller space",
    reserveRequestSamples,
    loyaltyOptInEnabled: map.loyaltyOptInEnabled === "true",
    loyaltyProgramName: map.loyaltyProgramName || "Loyalty Program",
    loyaltyOptInMessage: map.loyaltyOptInMessage || "Join our loyalty list for offers and updates by SMS.",
    loyaltyOptInLabel: map.loyaltyOptInLabel || "Yes, opt me in for loyalty messages.",
    weeklySchedule: parseWeeklySchedule(map.weeklySchedule, weeklyFallback),
    specialDepositRules: parseSpecialDepositRules(map.specialDepositRules, {
      amount: depositAmount,
      minParty: depositMinParty,
      message: depositMessage,
    }),
  };
}

export function getWeekdayKey(date: string): WeekdayKey {
  const d = new Date(`${date}T12:00:00`);
  const idx = Number.isNaN(d.getTime()) ? 0 : d.getDay();
  return WEEKDAY_KEYS[idx] || "sun";
}

export function getEffectiveScheduleForDate(
  settings: AppSettings,
  date: string,
  override?: { isClosed: boolean; openTime: string | null; closeTime: string | null; maxCovers: number | null } | null,
) {
  const weekdayKey = getWeekdayKey(date);
  const weekly = settings.weeklySchedule[weekdayKey] || {
    isClosed: false,
    openTime: settings.openTime,
    closeTime: settings.closeTime,
    maxCovers: settings.maxCoversPerSlot,
  };

  let isClosed = weekly.isClosed;
  let openTime = weekly.openTime || settings.openTime;
  let closeTime = weekly.closeTime || settings.closeTime;
  let maxCovers = typeof weekly.maxCovers === "number" ? weekly.maxCovers : settings.maxCoversPerSlot;

  if (override) {
    if (override.isClosed) {
      return {
        isClosed: true,
        openTime,
        closeTime,
        maxCovers,
      };
    }
    isClosed = false;
    if (override.openTime) openTime = override.openTime;
    if (override.closeTime) closeTime = override.closeTime;
    if (typeof override.maxCovers === "number" && Number.isFinite(override.maxCovers)) {
      maxCovers = Math.max(1, Math.trunc(override.maxCovers));
    }
  }

  return { isClosed, openTime, closeTime, maxCovers };
}

export function getEffectiveDepositForRequest(settings: AppSettings, date: string, partySize: number) {
  let enabled = settings.depositsEnabled;
  let amount = Math.max(0, settings.depositAmount);
  let minParty = Math.max(1, settings.depositMinParty);
  let message = settings.depositMessage;
  let source: "global" | "special" = "global";
  let label: string | null = null;

  const special = settings.specialDepositRules[date];
  if (special && special.enabled) {
    source = "special";
    label = special.label || null;
    if (special.requiresDeposit) {
      enabled = true;
      amount = Math.max(0, special.amount);
      minParty = Math.max(1, special.minParty);
      message = special.message || message;
    } else {
      enabled = false;
    }
  }

  const required = enabled && amount > 0 && partySize >= minParty;
  return {
    enabled,
    required,
    amount,
    minParty,
    message,
    source,
    label,
  };
}

export function getDiningDuration(durations: Record<string, number>, partySize: number): number {
  return durations[String(partySize)] || durations[String(8)] || 90;
}
