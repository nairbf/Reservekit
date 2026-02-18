import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { ADDON_PRICE_KEY, appUrl, getStripe, type AddonKey, type HostingKey, type PlanKey, PRICES } from "@/lib/stripe";

export const runtime = "nodejs";

interface CheckoutBody {
  plan?: PlanKey;
  addons?: AddonKey[];
  hosting?: HostingKey;
  customerEmail?: string;
  customerName?: string;
  restaurantName?: string;
}

function sanitizeAddons(addons: unknown): AddonKey[] {
  if (!Array.isArray(addons)) return [];
  const valid = new Set<AddonKey>(["sms", "floorPlan", "reporting", "guestHistory", "eventTicketing"]);
  return Array.from(new Set(addons.filter((v): v is AddonKey => typeof v === "string" && valid.has(v as AddonKey))));
}

export async function POST(request: NextRequest) {
  let body: CheckoutBody;
  try {
    body = (await request.json()) as CheckoutBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const plan = body.plan;
  const hosting = body.hosting || "none";
  const customerEmail = String(body.customerEmail || "").trim().toLowerCase();
  const customerName = String(body.customerName || "").trim();
  const restaurantName = String(body.restaurantName || "").trim();
  const addons = sanitizeAddons(body.addons);

  if (!plan || !["core", "servicePro", "fullSuite"].includes(plan)) {
    return NextResponse.json({ error: "A valid plan is required" }, { status: 400 });
  }

  if (!["none", "monthly", "annual"].includes(hosting)) {
    return NextResponse.json({ error: "Invalid hosting selection" }, { status: 400 });
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

  if (hosting === "monthly") {
    if (!PRICES.hostingMonthly) {
      return NextResponse.json({ error: "Missing Stripe price for monthly hosting" }, { status: 500 });
    }
    lineItems.push({ price: PRICES.hostingMonthly, quantity: 1 });
  } else if (hosting === "annual") {
    if (!PRICES.hostingAnnual) {
      return NextResponse.json({ error: "Missing Stripe price for annual hosting" }, { status: 500 });
    }
    lineItems.push({ price: PRICES.hostingAnnual, quantity: 1 });
  }

  const stripe = getStripe();
  const baseUrl = appUrl();

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: hosting === "none" ? "payment" : "subscription",
    line_items: lineItems,
    customer_email: customerEmail,
    success_url: `${baseUrl}/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/pricing`,
    metadata: {
      plan,
      addons: addons.join(","),
      hosting,
      customerName,
      customerEmail,
      restaurantName,
    },
    allow_promotion_codes: true,
  };

  if (hosting !== "none") {
    params.subscription_data = {
      trial_period_days: 14,
      metadata: {
        plan,
        hosting,
        customerName,
        customerEmail,
        restaurantName,
      },
    };
  }

  try {
    const session = await stripe.checkout.sessions.create(params);
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[STRIPE CHECKOUT ERROR]", error);
    return NextResponse.json({ error: "Could not create checkout session" }, { status: 500 });
  }
}
