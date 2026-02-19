import { NextRequest, NextResponse } from "next/server";

// LEGACY: This route is unused. Purchases flow through marketing-site/api/checkout instead.
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    {
      error: "This checkout endpoint is deprecated. Please use reservesit.com/pricing",
      redirect: "https://reservesit.com/pricing",
    },
    { status: 410 },
  );
}
