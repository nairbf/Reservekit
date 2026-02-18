import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(key);
}

export async function POST(request: NextRequest) {
  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch (error) {
    return NextResponse.json({ error: String((error as Error).message || "Stripe not configured") }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature") || "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  if (webhookSecret) {
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (error) {
      console.error("[STRIPE WEBHOOK] Invalid signature:", error);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  } else {
    // Local/dev fallback if webhook secret is not configured yet.
    try {
      event = JSON.parse(body) as Stripe.Event;
      if (!event?.type) {
        return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
      }
      console.warn("[STRIPE WEBHOOK] STRIPE_WEBHOOK_SECRET missing - signature verification skipped.");
    } catch {
      return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
    }
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log("[STRIPE] Checkout completed", {
        email: session.customer_email,
        plan: session.metadata?.plan,
        addons: session.metadata?.addons,
        hosting: session.metadata?.hosting,
        restaurantName: session.metadata?.restaurantName,
        amountTotal: session.amount_total,
      });
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      console.log("[STRIPE] Invoice paid", {
        email: invoice.customer_email,
        amount: invoice.amount_paid,
        id: invoice.id,
      });
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      console.log("[STRIPE] Subscription cancelled", {
        id: subscription.id,
        metadata: subscription.metadata,
      });
      break;
    }

    default:
      console.log("[STRIPE] Unhandled event:", event.type);
  }

  return NextResponse.json({ received: true });
}
