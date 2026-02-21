import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { appUrl, getStripe, PLAN_PRICES_AMOUNT, type PlanKey } from "@/lib/stripe";

export const runtime = "nodejs";

interface UpgradeBody {
  currentPlan?: PlanKey;
  targetPlan?: PlanKey;
  customerEmail?: string;
  customerName?: string;
  restaurantName?: string;
  addons?: string[] | string;
  existingAddons?: string[] | string;
}

export async function POST(request: NextRequest) {
  let body: UpgradeBody;
  try {
    body = (await request.json()) as UpgradeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const currentPlan = body.currentPlan;
  const targetPlan = body.targetPlan;
  const customerEmail = String(body.customerEmail || "").trim().toLowerCase();
  const customerName = String(body.customerName || "").trim();
  const restaurantName = String(body.restaurantName || "").trim();
  const addonsSource = body.existingAddons ?? body.addons ?? "";
  const addons = Array.isArray(addonsSource)
    ? addonsSource.map((item) => String(item || "").trim()).filter(Boolean).join(",")
    : String(addonsSource || "").trim();

  if (!currentPlan || !targetPlan) {
    return NextResponse.json({ error: "currentPlan and targetPlan are required" }, { status: 400 });
  }
  if (!(currentPlan in PLAN_PRICES_AMOUNT) || !(targetPlan in PLAN_PRICES_AMOUNT)) {
    return NextResponse.json({ error: "Invalid plan values" }, { status: 400 });
  }
  if (!customerEmail) {
    return NextResponse.json({ error: "customerEmail is required" }, { status: 400 });
  }

  const diff = PLAN_PRICES_AMOUNT[targetPlan] - PLAN_PRICES_AMOUNT[currentPlan];
  if (diff <= 0) {
    return NextResponse.json({ error: "Invalid upgrade path" }, { status: 400 });
  }

  const stripe = getStripe();
  const baseUrl = appUrl();

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: diff,
          product_data: {
            name: `Upgrade: ${currentPlan} → ${targetPlan}`,
            description: "ReserveSit plan upgrade",
          },
        },
      },
    ],
    customer_email: customerEmail,
    success_url: `${baseUrl}/purchase/success?session_id={CHECKOUT_SESSION_ID}&upgrade=true`,
    cancel_url: `${baseUrl}/pricing`,
    metadata: {
      plan: targetPlan,
      type: "upgrade",
      currentPlan,
      targetPlan,
      addons,
      customerName,
      restaurantName,
      customerEmail,
    },
    allow_promotion_codes: true,
  };

  try {
    const session = await stripe.checkout.sessions.create(params);
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[STRIPE UPGRADE ERROR]", error);
    return NextResponse.json({ error: "Could not create upgrade checkout" }, { status: 500 });
  }
}
