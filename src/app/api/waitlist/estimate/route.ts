import { NextRequest, NextResponse } from "next/server";
import { getTodaysWaitlist, estimateWaitMinutes } from "@/lib/waitlist";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const partySize = Math.max(1, parseInt(searchParams.get("partySize") || "2", 10) || 2);
  const rows = await getTodaysWaitlist();
  const estimate = await estimateWaitMinutes(
    partySize,
    rows.map(r => ({ partySize: r.partySize, status: r.status })),
  );
  return NextResponse.json(estimate);
}
