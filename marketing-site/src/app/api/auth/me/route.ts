import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/customer-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ user: session });
}
