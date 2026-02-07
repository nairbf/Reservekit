import { NextRequest, NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/availability";
import { getSettings, getDiningDuration } from "@/lib/settings";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const partySize = parseInt(searchParams.get("partySize") || "2");
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });
  const settings = await getSettings();
  const duration = getDiningDuration(settings.diningDurations, partySize);
  const slots = await getAvailableSlots(date, partySize);
  return NextResponse.json({ date, partySize, diningDurationMinutes: duration, slots });
}
