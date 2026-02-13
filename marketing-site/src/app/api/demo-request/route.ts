import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  console.log("[demo-request]", body);
  return NextResponse.json({ ok: true, message: "Demo request submitted." });
}
