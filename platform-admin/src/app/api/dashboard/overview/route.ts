import { NextRequest, NextResponse } from "next/server";
import { requireSessionFromRequest } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { getOverviewData } from "@/lib/overview";

export async function GET(req: NextRequest) {
  try {
    requireSessionFromRequest(req);
  } catch {
    return unauthorized();
  }

  const data = await getOverviewData();
  return NextResponse.json(data);
}
