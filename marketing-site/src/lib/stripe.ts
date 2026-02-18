import Stripe from "stripe";

export const PLAN_PRICES_AMOUNT = {
  core: 179900,
  servicePro: 222700,
  fullSuite: 273400,
} as const;

export const PRICES = {
  core: process.env.STRIPE_PRICE_CORE || "",
  servicePro: process.env.STRIPE_PRICE_SERVICE_PRO || "",
  fullSuite: process.env.STRIPE_PRICE_FULL_SUITE || "",
  hostingMonthly: process.env.STRIPE_PRICE_HOSTING_MONTHLY || "",
  hostingAnnual: process.env.STRIPE_PRICE_HOSTING_ANNUAL || "",
  sms: process.env.STRIPE_PRICE_SMS || "",
  floorPlan: process.env.STRIPE_PRICE_FLOOR_PLAN || "",
  reporting: process.env.STRIPE_PRICE_REPORTING || "",
  guestHistory: process.env.STRIPE_PRICE_GUEST_HISTORY || "",
  eventTicketing: process.env.STRIPE_PRICE_EVENT_TICKETING || "",
} as const;

let cachedStripe: Stripe | null = null;

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  if (!cachedStripe) {
    cachedStripe = new Stripe(key);
  }

  return cachedStripe;
}

export function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "https://reservesit.com";
}

export type PlanKey = keyof typeof PLAN_PRICES_AMOUNT;
export type AddonKey = "sms" | "floorPlan" | "reporting" | "guestHistory" | "eventTicketing";
export type HostingKey = "none" | "monthly" | "annual";

export const ADDON_PRICE_KEY: Record<AddonKey, keyof typeof PRICES> = {
  sms: "sms",
  floorPlan: "floorPlan",
  reporting: "reporting",
  guestHistory: "guestHistory",
  eventTicketing: "eventTicketing",
};
