import { NextRequest, NextResponse } from "next/server";
import { getStripeInstance, getStripeWebhookSecret } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const stripe = await getStripeInstance();
  const webhookSecret = await getStripeWebhookSecret();
  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured — rejecting webhook");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  try {
    const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      console.log(`[PURCHASE] ${session.customer_email} bought: ${session.metadata?.products}`);
    }
  } catch { return NextResponse.json({ error: "Invalid signature" }, { status: 400 }); }
  return NextResponse.json({ received: true });
}
