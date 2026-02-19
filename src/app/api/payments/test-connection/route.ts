import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getStripeInstance } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST() {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stripe = await getStripeInstance();
  if (!stripe) {
    return NextResponse.json({ connected: false, error: "No Stripe secret key configured" });
  }

  try {
    const account = await stripe.accounts.retrieve();
    return NextResponse.json({
      connected: true,
      accountId: account.id,
      businessName: account.business_profile?.name || null,
    });
  } catch (error) {
    return NextResponse.json({
      connected: false,
      error: error instanceof Error ? error.message : "Invalid Stripe key",
    });
  }
}

