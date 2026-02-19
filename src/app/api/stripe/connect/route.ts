import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Stripe Connect not configured" }, { status: 500 });
  }

  const state = crypto.randomBytes(32).toString("hex");
  await prisma.setting.upsert({
    where: { key: "stripe_oauth_state" },
    update: { value: state },
    create: { key: "stripe_oauth_state", value: state },
  });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://localhost:3001").replace(/\/$/, "");
  const redirectUri = `${appUrl}/api/stripe/callback`;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: "read_write",
    redirect_uri: redirectUri,
    state,
    "stripe_user[business_type]": "company",
  });

  return NextResponse.redirect(`https://connect.stripe.com/oauth/authorize?${params.toString()}`);
}
