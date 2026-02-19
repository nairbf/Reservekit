import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST() {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [accountSetting, refreshSetting] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "stripeAccountId" } }),
    prisma.setting.findUnique({ where: { key: "stripeRefreshToken" } }),
  ]);

  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
  const clientSecret = process.env.STRIPE_SECRET_KEY;
  const stripeUserId = accountSetting?.value || "";
  const refreshToken = refreshSetting?.value || "";

  if (clientId && clientSecret && stripeUserId) {
    try {
      const body = new URLSearchParams({
        client_id: clientId,
        stripe_user_id: stripeUserId,
      });
      if (refreshToken) body.set("refresh_token", refreshToken);

      await fetch("https://connect.stripe.com/oauth/deauthorize", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
    } catch {
      // Keep local cleanup even if Stripe deauthorize call fails.
    }
  }

  await prisma.setting.deleteMany({
    where: {
      key: {
        in: [
          "stripeSecretKey",
          "stripePublishableKey",
          "stripeAccountId",
          "stripeRefreshToken",
          "stripeWebhookSecret",
        ],
      },
    },
  });

  return NextResponse.json({ ok: true });
}
