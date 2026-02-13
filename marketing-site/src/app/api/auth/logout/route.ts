import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/customer-auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const response = NextResponse.json({ ok: true });
  clearAuthCookie(response, req);
  return response;
}
