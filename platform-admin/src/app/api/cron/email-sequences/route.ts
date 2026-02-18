import { NextRequest, NextResponse } from "next/server";
import { processPendingEmails } from "@/lib/email-sequences";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  const expected = process.env.CRON_SECRET?.trim();

  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processPendingEmails();
  return NextResponse.json(result);
}
