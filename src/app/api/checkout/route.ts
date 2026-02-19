import { NextRequest, NextResponse } from "next/server";
import { getAppUrlFromRequest } from "@/lib/app-url";
import { getStripeInstance } from "@/lib/stripe";

const PRODUCTS: Record<string, { name: string; price: number }> = {
  core: { name: "ReserveSit Core", price: 179900 },
  sms: { name: "SMS Add-On", price: 19900 },
  floorplan: { name: "Visual Floor Plan", price: 24900 },
  reports: { name: "Reporting Dashboard", price: 17900 },
  guesthistory: { name: "Guest History", price: 17900 },
  eventticketing: { name: "Event Ticketing", price: 12900 },
};

export async function POST(req: NextRequest) {
  const stripe = await getStripeInstance();
  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  const appUrl = getAppUrlFromRequest(req);
  const { items, email } = await req.json();

  const lineItems = (items as string[]).filter(id => PRODUCTS[id]).map(id => ({
    price_data: { currency: "usd", product_data: { name: PRODUCTS[id].name }, unit_amount: PRODUCTS[id].price },
    quantity: 1,
  }));
  if (lineItems.length === 0) return NextResponse.json({ error: "No valid items" }, { status: 400 });

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"], line_items: lineItems, mode: "payment",
    success_url: `${appUrl}/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/#pricing`,
    customer_email: email, metadata: { products: items.join(",") },
  });
  return NextResponse.json({ url: session.url });
}
