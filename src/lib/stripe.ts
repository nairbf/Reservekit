import { prisma } from "./db";

async function getSettingValue(key: string): Promise<string | null> {
  const setting = await prisma.setting.findUnique({ where: { key } });
  const value = String(setting?.value || "").trim();
  return value || null;
}

export async function getStripeSecretKey(): Promise<string | null> {
  return (await getSettingValue("stripeSecretKey")) || process.env.STRIPE_SECRET_KEY || null;
}

export async function getStripePublishableKey(): Promise<string | null> {
  return (
    (await getSettingValue("stripePublishableKey")) ||
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
    process.env.STRIPE_PUBLISHABLE_KEY ||
    null
  );
}

export async function getStripeWebhookSecret(): Promise<string | null> {
  return (await getSettingValue("stripeWebhookSecret")) || process.env.STRIPE_WEBHOOK_SECRET || null;
}

export async function getStripeInstance() {
  const key = await getStripeSecretKey();
  if (!key) return null;
  const Stripe = (await import("stripe")).default;
  return new Stripe(key);
}

