import { NextRequest, NextResponse } from "next/server";
import { getSettings, getEffectiveDepositForRequest } from "@/lib/settings";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
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
