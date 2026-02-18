import { NextRequest, NextResponse } from "next/server";
import { getSettings, getEffectiveDepositForRequest } from "@/lib/settings";
import { getRestaurantTimezone, getTodayInTimezone } from "@/lib/timezone";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const timezone = await getRestaurantTimezone();
  const date = searchParams.get("date") || getTodayInTimezone(timezone);
  const partySize = Math.max(1, parseInt(searchParams.get("partySize") || "2", 10) || 2);
  const settings = await getSettings();
  const deposit = getEffectiveDepositForRequest(settings, date, partySize);

  return NextResponse.json({
    enabled: settings.depositEnabled,
    type: settings.depositType,
    required: deposit.required,
    amount: deposit.amount,
    minPartySize: deposit.minParty,
    message: deposit.message,
    source: deposit.source,
    label: deposit.label,
  });
}
