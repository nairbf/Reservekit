import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

function maskValue(value: string, prefixLength: number): string {
  if (!value) return value;
  if (value.length <= prefixLength + 4) return value;
  return `${value.slice(0, prefixLength)}••••••••${value.slice(-4)}`;
}

function isMaskedValue(value: string): boolean {
  return value.includes("•") || /\*{3,}/.test(value);
}

const WRITABLE_SETTINGS = new Set([
  "restaurantName",
  "slug",
  "tagline",
  "description",
  "accentColor",
  "logoUrl",
  "heroImageUrl",
  "faviconUrl",
  "phone",
  "address",
  "contactEmail",
  "landing_sections",
  "timezone",
  "openTime",
  "closeTime",
  "slotInterval",
  "lastSeatingBufferMin",
  "maxCoversPerSlot",
  "maxPartySize",
  "diningDurations",
  "weeklySchedule",
  "bookingLeadHours",
  "defaultPartySizes",
  "reservationApprovalMode",
  "cancellationPolicy",
  "selfServiceCutoffHours",
  "depositEnabled",
  "depositType",
  "depositAmount",
  "depositMinPartySize",
  "depositMessage",
  "specialDepositRules",
  "noshowChargeEnabled",
  "noshowChargeAmount",
  "emailEnabled",
  "emailSendConfirmations",
  "emailSendReminders",
  "emailSendWaitlist",
  "reminderLeadHours",
  "replyToEmail",
  "staffNotificationEmail",
  "staffNotificationsEnabled",
  "largePartyThreshold",
  "twilioSid",
  "twilioToken",
  "twilioPhone",
  "sms_template_confirmed",
  "sms_template_reminder",
  "sms_template_cancelled",
  "sms_template_waitlist_ready",
  "loyaltyOptInEnabled",
  "loyaltyProgramName",
  "loyaltyOptInMessage",
  "loyaltyOptInLabel",
  "expressDiningEnabled",
  "expressDiningMode",
  "expressDiningPayment",
  "expressDiningCutoffHours",
  "expressDiningMessage",
  "spotonApiKey",
  "spotonLocationId",
  "spotonEnvironment",
  "spotonUseMock",
  "reserveHeading",
  "reserveSubheading",
  "reserveConfirmationMessage",
  "setupWizardStep",
  "setupWizardCompleted",
  "setupWizardCompletedAt",
]);

function shouldExcludeFromSettingsResponse(key: string) {
  return (
    key.startsWith("pos_status_")
    || key.startsWith("spoton_table_")
    || key.startsWith("loyalty_phone_")
    || key === "stripe_oauth_state"
  );
}

function maskSensitiveSetting(key: string, value: string): string | null {
  if (key.startsWith("pos_credentials_")) return value ? "[configured]" : "";
  if (key === "stripeSecretKey") return maskValue(value, 7);
  if (key === "stripeWebhookSecret") return maskValue(value, 6);
  if (key === "stripeRefreshToken") return maskValue(value, 6);
  if (key === "spotonApiKey") return maskValue(value, 4);
  if (key === "twilioSid") return maskValue(value, 4);
  if (key === "twilioToken") return maskValue(value, 4);
  return null;
}

export async function GET() {
  try {
    await requirePermission("manage_settings");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await prisma.setting.findMany();
  const response: Record<string, string> = {};
  for (const row of rows) {
    if (shouldExcludeFromSettingsResponse(row.key)) continue;
    const masked = maskSensitiveSetting(row.key, row.value);
    response[row.key] = masked ?? row.value;
  }
  response.stripeConnectEnabled = process.env.STRIPE_CONNECT_CLIENT_ID ? "true" : "false";
  return NextResponse.json(response);
}

export async function PUT(req: NextRequest) {
  try {
    await requirePermission("manage_settings");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = (await req.json()) as Record<string, unknown> | null;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const invalidKeys: string[] = [];
  const updates: Array<{ key: string; value: string }> = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === "stripeConnectEnabled") continue;
    if (!WRITABLE_SETTINGS.has(key)) {
      invalidKeys.push(key);
      continue;
    }
    const nextValue = String(value ?? "");
    if (isMaskedValue(nextValue)) {
      continue;
    }
    updates.push({ key, value: nextValue });
  }

  if (invalidKeys.length > 0) {
    return NextResponse.json(
      { error: "One or more settings cannot be updated through this endpoint.", invalidKeys },
      { status: 400 },
    );
  }

  for (const update of updates) {
    await prisma.setting.upsert({
      where: { key: update.key },
      update: { value: update.value },
      create: { key: update.key, value: update.value },
    });
  }

  return NextResponse.json({ ok: true });
}
