import { NextRequest, NextResponse } from "next/server";
import { getAvailableSlots, timeToMinutes } from "@/lib/availability";
import { getSettings, getDiningDuration, getEffectiveDepositForRequest } from "@/lib/settings";
import { getCurrentTimeInTimezone, getRestaurantTimezone, getTodayInTimezone } from "@/lib/timezone";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const partySize = parseInt(searchParams.get("partySize") || "2");
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });
  const settings = await getSettings();
  const duration = getDiningDuration(settings.diningDurations, partySize);
  const timezone = await getRestaurantTimezone();
  const today = getTodayInTimezone(timezone);
  const currentTime = getCurrentTimeInTimezone(timezone);
  const slotsRaw = await getAvailableSlots(date, partySize);
  const slots = slotsRaw.map((slot) => {
    if (!slot.available) return slot;
    if (date < today) return { ...slot, available: false, reason: "past_date" };
    if (date === today && timeToMinutes(slot.time) < timeToMinutes(currentTime)) {
      return { ...slot, available: false, reason: "past_time" };
    }
    return slot;
  });
  const deposit = getEffectiveDepositForRequest(settings, date, partySize);
  return NextResponse.json({
    date,
    partySize,
    diningDurationMinutes: duration,
    slots,
    deposit: {
      required: deposit.required,
      amount: deposit.amount,
      minParty: deposit.minParty,
      type: settings.depositType,
      message: deposit.message,
      source: deposit.source,
      label: deposit.label,
    },
  });
}
