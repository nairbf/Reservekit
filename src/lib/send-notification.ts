import { prisma } from "@/lib/db";
import { sendEmail, type EmailAttachment } from "@/lib/email";
import { getTemplate, getSampleVariables, renderTemplate } from "@/lib/email-templates";

interface SendNotificationOptions {
  templateId: string;
  to: string;
  variables?: Record<string, string>;
  reservationId?: number;
  messageType?: string;
  attachments?: EmailAttachment[];
  force?: boolean;
}

function boolFromSetting(value?: string | null, fallback = false): boolean {
  if (value == null || value === "") return fallback;
  return value === "true";
}

function shouldSkipByTemplate(templateId: string, settings: Record<string, string>): boolean {
  const emailEnabled = boolFromSetting(settings.emailEnabled, true);
  if (!emailEnabled) return true;

  if (templateId === "reservation_confirmed") {
    return !boolFromSetting(settings.emailSendConfirmations, true);
  }
  if (templateId === "reservation_reminder") {
    return !boolFromSetting(settings.emailSendReminders, true);
  }
  if (templateId === "waitlist_added" || templateId === "waitlist_ready") {
    return !boolFromSetting(settings.emailSendWaitlist, true);
  }

  return false;
}

export async function sendNotification(options: SendNotificationOptions) {
  const recipient = String(options.to || "").trim();
  if (!recipient) {
    return { success: false, error: "No recipient" };
  }

  const settingsRows = await prisma.setting.findMany({
    where: {
      key: {
        in: [
          "restaurantName",
          "accentColor",
          "logoUrl",
          "phone",
          "contactEmail",
          "emailReplyTo",
          "address",
          "slug",
          "emailEnabled",
          "emailSendConfirmations",
          "emailSendReminders",
          "emailSendWaitlist",
        ],
      },
    },
  });

  const settings: Record<string, string> = {};
  for (const row of settingsRows) settings[row.key] = row.value;

  if (!options.force && shouldSkipByTemplate(options.templateId, settings)) {
    console.log(`[EMAIL SKIP] Template ${options.templateId} disabled by settings.`);
    return { success: false, error: "Template disabled by settings" };
  }

  const template = await getTemplate(options.templateId);

  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const vars = {
    ...getSampleVariables(),
    restaurantName: settings.restaurantName || "Restaurant",
    restaurantPhone: settings.phone || "",
    restaurantEmail: settings.emailReplyTo || settings.contactEmail || "",
    restaurantAddress: settings.address || "",
    accentColor: settings.accentColor || "#1e3a5f",
    logoUrl: settings.logoUrl || "",
    manageUrl: `${appUrl}/reservation/manage`,
    reserveUrl: `${appUrl}/reserve/${settings.slug || "test"}`,
    ...options.variables,
  };

  const { subject, html } = renderTemplate(template, vars);

  return sendEmail({
    to: recipient,
    subject,
    html,
    replyTo: settings.emailReplyTo || settings.contactEmail || undefined,
    slug: settings.slug || undefined,
    reservationId: options.reservationId,
    messageType: options.messageType || options.templateId,
    attachments: options.attachments,
  });
}
