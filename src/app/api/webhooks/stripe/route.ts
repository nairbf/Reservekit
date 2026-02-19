import { NextRequest, NextResponse } from "next/server";
import { getStripeInstance, getStripeWebhookSecret } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const stripe = await getStripeInstance();
  const webhookSecret = await getStripeWebhookSecret();
  if (!stripe || !webhookSecret) return NextResponse.json({ error: "Not configured" }, { status: 400 });
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
