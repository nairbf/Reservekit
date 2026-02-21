import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { ADDON_PRICE_KEY, appUrl, getStripe, type AddonKey, type PlanKey, PRICES } from "@/lib/stripe";

export const runtime = "nodejs";

interface CheckoutBody {
  plan?: PlanKey;
  addons?: AddonKey[];
  selfHost?: boolean;
  customerEmail?: string;
  customerName?: string;
  restaurantName?: string;
}

function sanitizeAddons(addons: unknown): AddonKey[] {
  if (!Array.isArray(addons)) return [];
  const valid = new Set<AddonKey>(["sms", "floorPlan", "reporting", "guestHistory", "eventTicketing", "customDomain"]);
  return Array.from(new Set(addons.filter((v): v is AddonKey => typeof v === "string" && valid.has(v as AddonKey))));
}

function hostingTierForPlan(plan: PlanKey) {
  return plan === "core" ? "core_299" : "pro_399";
}

export async function POST(request: NextRequest) {
  let body: CheckoutBody;
  try {
    body = (await request.json()) as CheckoutBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const plan = body.plan;
  const selfHost = body.selfHost === true;
  const customerEmail = String(body.customerEmail || "").trim().toLowerCase();
  const customerName = String(body.customerName || "").trim();
  const restaurantName = String(body.restaurantName || "").trim();
  const addons = sanitizeAddons(body.addons);

  if (!plan || !["core", "servicePro", "fullSuite"].includes(plan)) {
    return NextResponse.json({ error: "A valid plan is required" }, { status: 400 });
  }

  if (!customerEmail || !customerName || !restaurantName) {
    return NextResponse.json({ error: "customerName, customerEmail, and restaurantName are required" }, { status: 400 });
  }

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

  const planPriceId = PRICES[plan];
  if (!planPriceId) {
    return NextResponse.json({ error: `Missing Stripe price for plan: ${plan}` }, { status: 500 });
  }
  lineItems.push({ price: planPriceId, quantity: 1 });

  for (const addon of addons) {
    const mappedKey = ADDON_PRICE_KEY[addon];
    const addonPriceId = PRICES[mappedKey];
    if (!addonPriceId) {
      return NextResponse.json({ error: `Missing Stripe price for add-on: ${addon}` }, { status: 500 });
    }
    lineItems.push({ price: addonPriceId, quantity: 1 });
  }

  const stripe = getStripe();
  const baseUrl = appUrl();

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    line_items: lineItems,
    customer_email: customerEmail,
    success_url: `${baseUrl}/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/pricing`,
    metadata: {
      plan,
      addons: addons.join(","),
      hosting: selfHost ? "false" : "true",
      hostingTier: selfHost ? "self_hosted" : hostingTierForPlan(plan),
      hostingRenewalDate: selfHost ? "" : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      selfHost: selfHost ? "true" : "false",
      customerName,
      customerEmail,
      restaurantName,
    },
    allow_promotion_codes: true,
  };

  try {
    const session = await stripe.checkout.sessions.create(params);
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[STRIPE CHECKOUT ERROR]", error);
    return NextResponse.json({ error: "Could not create checkout session" }, { status: 500 });
  }
}
