import { headers } from "next/headers";

export interface FaqItem {
  q: string;
  a: string;
}

export type MarketingSettings = Record<string, string>;

export const DEFAULT_FAQ_ITEMS: FaqItem[] = [
  {
    q: "How is ReserveSit different from OpenTable?",
    a: "ReserveSit is a one-time license ($2,199 / $2,999 / $3,799) and you keep full ownership of your data.",
  },
  {
    q: "How do I migrate from OpenTable/Resy?",
    a: "We help with setup and data import so your team can switch quickly.",
  },
  {
    q: "Can I try it before buying?",
    a: "Yes. The live demo at demo.reservesit.com is fully working and resets nightly.",
  },
];

export const DEFAULT_MARKETING_SETTINGS: MarketingSettings = {
  hero_badge: "🚀 Now in production - restaurants are live",
  hero_headline: "The reservation platform you buy once and own.",
  hero_subheadline:
    "OpenTable and similar platforms start at $3,000-$3,600/year on their lowest plans - and go up from there. ReserveSit starts at a one-time $2,199 license.",
  hero_cta_primary_text: "See Pricing",
  hero_cta_primary_url: "/pricing",
  hero_cta_secondary_text: "Book a Demo Call",
  hero_cta_secondary_url: "/demo",
  hero_image: "/dashboard-mockup.png",
  features_headline: "Features Built for Real Service",
  features_subheadline: "Everything your team needs to run reservations without subscription lock-in.",
  integrations_list: "📍 SpotOn, 🟩 Square, 🍞 Toast, 🍀 Clover, 💳 Stripe",
  demo_section_headline: "👀 See it in action",
  demo_section_body: "Explore a fully working demo instance with real data. No sign-up required.",
  about_headline: "Built by operators, for operators.",
  about_body:
    "ReserveSit was created to give independent restaurants the same technology as the big chains - without the recurring fees.",
  demo_page_headline: "Try ReserveSit right now",
  demo_page_body: "Our demo instance has real data and resets nightly. No sign-up required.",
  faq_items: JSON.stringify(DEFAULT_FAQ_ITEMS),
};

function normalizeSettings(payload: unknown): MarketingSettings {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};

  const normalized: MarketingSettings = {};
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (!key.trim()) continue;
    if (typeof value !== "string") continue;
    normalized[key] = value;
  }

  return normalized;
}

async function resolveRequestBaseUrl() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host");
  const protoHeader = headerStore.get("x-forwarded-proto");
  const proto = protoHeader || (host?.includes("localhost") ? "http" : "https");

  if (host) return `${proto}://${host}`;

  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3200";
}

export async function fetchMarketingSettings(): Promise<MarketingSettings> {
  const baseUrl = await resolveRequestBaseUrl();

  try {
    const res = await fetch(`${baseUrl}/api/marketing-settings`, { cache: "no-store" });
    if (!res.ok) return {};

    const payload = (await res.json()) as { settings?: unknown };
    return normalizeSettings(payload.settings);
  } catch {
    return {};
  }
}

export function withMarketingDefaults(settings: MarketingSettings): MarketingSettings {
  return { ...DEFAULT_MARKETING_SETTINGS, ...settings };
}

export function parseIntegrations(raw: string | undefined): string[] {
  if (!raw) return ["📍 SpotOn", "🟩 Square", "🍞 Toast", "🍀 Clover", "💳 Stripe"];
  const parsed = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : ["📍 SpotOn", "🟩 Square", "🍞 Toast", "🍀 Clover", "💳 Stripe"];
}

export function parseFaqItems(raw: string | undefined): FaqItem[] {
  if (!raw) return DEFAULT_FAQ_ITEMS;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_FAQ_ITEMS;

    const items = parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as { q?: unknown; a?: unknown };
        const q = String(row.q || "").trim();
        const a = String(row.a || "").trim();
        if (!q || !a) return null;
        return { q, a };
      })
      .filter((item): item is FaqItem => Boolean(item));

    return items.length > 0 ? items : DEFAULT_FAQ_ITEMS;
  } catch {
    return DEFAULT_FAQ_ITEMS;
  }
}
