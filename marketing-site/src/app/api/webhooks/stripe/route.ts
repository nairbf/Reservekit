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
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured — rejecting webhook");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    console.error("[STRIPE WEBHOOK] Invalid signature:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.customer_email && session.metadata?.plan) {
        try {
          const adminApiUrl = process.env.ADMIN_API_URL || "https://admin.reservesit.com";
          const sharedSecret = process.env.PLATFORM_WEBHOOK_SECRET || "";

          const response = await fetch(`${adminApiUrl}/api/webhooks/stripe-purchase`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Webhook-Secret": sharedSecret,
            },
            body: JSON.stringify({
              email: session.customer_email,
              name: session.metadata?.customerName || session.customer_details?.name || "",
              restaurantName: session.metadata?.restaurantName || "",
              plan: session.metadata?.plan || "core",
              addons: session.metadata?.addons || "",
              hosting: session.metadata?.hosting || "none",
              amountTotal: session.amount_total || 0,
              stripeSessionId: session.id,
              stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id || "",
            }),
          });

          if (!response.ok) {
            const details = await response.text();
            console.error("[STRIPE] Platform admin webhook failed", response.status, details);
          }
        } catch (error) {
          console.error("[STRIPE] Failed to notify platform admin:", error);
        }
      }
      break;
    }

    case "invoice.payment_succeeded": {
      break;
    }

    case "customer.subscription.deleted": {
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
