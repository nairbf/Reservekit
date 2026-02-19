import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/customer-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const secret = process.env.PLATFORM_WEBHOOK_SECRET?.trim();
  const adminApiUrl = process.env.ADMIN_API_URL || "https://admin.reservesit.com";

  if (secret) {
    try {
      const response = await fetch(
        `${adminApiUrl}/api/auth/customer-info?email=${encodeURIComponent(session.email)}`,
        {
          headers: { "X-Webhook-Secret": secret },
          cache: "no-store",
        },
      );

      if (response.ok) {
        const restaurant = await response.json();
        const restaurantSlug =
          typeof restaurant?.slug === "string" && restaurant.slug.trim().length > 0
            ? restaurant.slug
            : null;
        const restaurantUrl = restaurantSlug
          ? `https://${restaurantSlug}.reservesit.com`
          : null;

        return NextResponse.json({
          user: session,
          restaurant,
          restaurantSlug,
          restaurantUrl,
        });
      }
    } catch {
      // Keep portal session valid even if admin service is temporarily unavailable.
    }
  }

  return NextResponse.json({ user: session, restaurantSlug: null, restaurantUrl: null });
}
