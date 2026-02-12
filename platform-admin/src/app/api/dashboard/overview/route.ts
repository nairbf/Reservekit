import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { getOverviewData } from "@/lib/overview";

export async function GET() {
  try {
    await requireSession();
  } catch {
    return unauthorized();
  }

  const data = await getOverviewData();
  return NextResponse.json(data);
}
