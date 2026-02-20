import Stripe from "stripe";

export const PLAN_PRICES_AMOUNT = {
  core: 219900,
  servicePro: 299900,
  fullSuite: 379900,
} as const;

export const PRICES = {
  core: process.env.STRIPE_PRICE_CORE || "",
  servicePro: process.env.STRIPE_PRICE_SERVICE_PRO || "",
  fullSuite: process.env.STRIPE_PRICE_FULL_SUITE || "",
  hostingCore: process.env.STRIPE_PRICE_HOSTING_CORE || "",
  hostingPro: process.env.STRIPE_PRICE_HOSTING_PRO || "",
  sms: process.env.STRIPE_PRICE_SMS || "",
  floorPlan: process.env.STRIPE_PRICE_FLOOR_PLAN || "",
  reporting: process.env.STRIPE_PRICE_REPORTING || "",
  guestHistory: process.env.STRIPE_PRICE_GUEST_HISTORY || "",
  eventTicketing: process.env.STRIPE_PRICE_EVENT_TICKETING || "",
  customDomain: process.env.STRIPE_PRICE_CUSTOM_DOMAIN || "",
} as const;

let cachedStripe: Stripe | null = null;

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  if (!cachedStripe) cachedStripe = new Stripe(key);
  return cachedStripe;
}

export function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "https://reservesit.com";
}

export type PlanKey = keyof typeof PLAN_PRICES_AMOUNT;
export type AddonKey = "sms" | "floorPlan" | "reporting" | "guestHistory" | "eventTicketing" | "customDomain";

export const ADDON_PRICE_KEY: Record<AddonKey, keyof typeof PRICES> = {
  sms: "sms",
  floorPlan: "floorPlan",
  reporting: "reporting",
  guestHistory: "guestHistory",
  eventTicketing: "eventTicketing",
  customDomain: "customDomain",
};

export const HOSTING_PRICE_KEY: Record<string, keyof typeof PRICES> = {
  core: "hostingCore",
  servicePro: "hostingPro",
  fullSuite: "hostingPro",
};
