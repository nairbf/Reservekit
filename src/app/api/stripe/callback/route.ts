import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

function redirectWithError(appUrl: string, message: string) {
  return NextResponse.redirect(
    `${appUrl}/dashboard/settings?tab=reservations&stripe_error=${encodeURIComponent(message)}`,
  );
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");
  const errorDescription = req.nextUrl.searchParams.get("error_description");
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://localhost:3001").replace(/\/$/, "");

  if (error) {
    return redirectWithError(appUrl, errorDescription || error);
  }
  if (!code || !state) {
    return redirectWithError(appUrl, "missing_params");
  }

  const savedState = await prisma.setting.findUnique({ where: { key: "stripe_oauth_state" } });
  if (!savedState || savedState.value !== state) {
    return redirectWithError(appUrl, "invalid_state");
  }

  await prisma.setting.delete({ where: { key: "stripe_oauth_state" } }).catch(() => undefined);

  const clientSecret = process.env.STRIPE_SECRET_KEY;
  if (!clientSecret) {
    return redirectWithError(appUrl, "missing_platform_secret");
  }

  try {
    const response = await fetch("https://connect.stripe.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_secret: clientSecret,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      error_description?: string;
      access_token?: string;
      refresh_token?: string;
      stripe_user_id?: string;
      stripe_publishable_key?: string;
    };

    if (!response.ok || data.error || !data.access_token || !data.stripe_publishable_key || !data.stripe_user_id) {
      return redirectWithError(appUrl, data.error_description || data.error || "oauth_exchange_failed");
    }

    const entries: Array<[string, string]> = [
      ["stripeSecretKey", data.access_token],
      ["stripePublishableKey", data.stripe_publishable_key],
      ["stripeAccountId", data.stripe_user_id],
    ];
    if (data.refresh_token) {
      entries.push(["stripeRefreshToken", data.refresh_token]);
    }

    for (const [key, value] of entries) {
      await prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }

    return NextResponse.redirect(`${appUrl}/dashboard/settings?tab=reservations&stripe_connected=true`);
  } catch (err) {
    return redirectWithError(appUrl, String(err));
  }
}
