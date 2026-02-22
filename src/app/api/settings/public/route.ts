import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureLicenseSettings } from "@/lib/license-sync";

const PUBLIC_SETTINGS_KEYS = new Set([
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
  "timezone",
  "openTime",
  "closeTime",
  "slotInterval",
  "lastSeatingBufferMin",
  "maxCoversPerSlot",
  "maxPartySize",
  "weeklySchedule",
  "diningDurations",
  "bookingLeadHours",
  "defaultPartySizes",
  "reservationApprovalMode",
  "cancellationPolicy",
  "selfServiceCutoffHours",
  "depositEnabled",
  "depositsEnabled",
  "depositType",
  "depositAmount",
  "depositMinPartySize",
  "depositMinParty",
  "depositMessage",
  "specialDepositRules",
  "emailEnabled",
  "emailSendConfirmations",
  "emailSendReminders",
  "emailSendWaitlist",
  "emailReminderTiming",
  "reminderLeadHours",
  "emailReplyTo",
  "replyToEmail",
  "emailStaffNotification",
  "staffNotificationEmail",
  "staffNotificationsEnabled",
  "largePartyThreshold",
  "loyaltyOptInEnabled",
  "loyaltyProgramName",
  "loyaltyOptInMessage",
  "loyaltyOptInLabel",
  "expressDiningEnabled",
  "expressDiningMode",
  "expressDiningPayment",
  "expressDiningCutoffHours",
  "expressDiningMessage",
  "setupWizardStep",
  "setupWizardCompleted",
  "setupWizardCompletedAt",
  "landing_sections",
  "menu_files",
  "noshowChargeEnabled",
  "noshowChargeAmount",
  "feature_sms",
  "feature_floorplan",
  "feature_reporting",
  "feature_guest_history",
  "feature_event_ticketing",
  "license_plan",
  "license_status",
  "license_valid",
  "license_last_check",
  "license_expressdining",
]);

const SENSITIVE_PATTERN = /(stripe|spoton|twilio|pos_credentials|oauth|token|secret|password|apikey|api_key)/i;

function isSafePublicKey(key: string) {
  if (key.startsWith("loyalty_phone_")) return false;
  if (SENSITIVE_PATTERN.test(key)) return false;
  return PUBLIC_SETTINGS_KEYS.has(key);
}

export async function GET() {
  let session: Awaited<ReturnType<typeof requireAuth>>;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureLicenseSettings(session.email);

  const settings = await prisma.setting.findMany();
  const response: Record<string, string> = {};
  for (const setting of settings) {
    if (!isSafePublicKey(setting.key)) continue;
    response[setting.key] = setting.value;
  }
  return NextResponse.json(response);
}
