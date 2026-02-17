import { prisma } from "@/lib/db";

export interface TemplateData {
  subject: string;
  heading: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
  footerText: string;
}

export interface TemplateRecord extends TemplateData {
  id: string;
  name: string;
  customized: boolean;
}

const TEMPLATE_NAMES: Record<string, string> = {
  reservation_confirmed: "Reservation Confirmed",
  reservation_cancelled: "Reservation Cancelled",
  reservation_reminder: "Reservation Reminder",
  reservation_request_received: "Reservation Request Received",
  waitlist_added: "Added to Waitlist",
  waitlist_ready: "Table Ready (Waitlist)",
  event_ticket_confirmation: "Event Ticket Confirmation",
  password_reset: "Password Reset",
};

export const DEFAULT_TEMPLATES: Record<string, TemplateData> = {
  reservation_confirmed: {
    subject: "Your reservation is confirmed — {{restaurantName}}",
    heading: "Reservation Confirmed!",
    body: "Hi {{guestName}},\n\nGreat news! Your reservation has been confirmed.\n\nDate: {{date}}\nTime: {{time}}\nParty size: {{partySize}}\n\nConfirmation code: {{confirmationCode}}\n\n{{preOrderLine}}\n\nWe look forward to welcoming you!",
    ctaText: "Manage Reservation",
    ctaUrl: "{{manageUrl}}",
    footerText: "Need to make changes? Click above or reply to this email.",
  },
  reservation_cancelled: {
    subject: "Reservation cancelled — {{restaurantName}}",
    heading: "Reservation Cancelled",
    body: "Hi {{guestName}},\n\nYour reservation for {{date}} at {{time}} has been cancelled.\n\nIf this was a mistake or you'd like to rebook, we'd love to have you.",
    ctaText: "Make a New Reservation",
    ctaUrl: "{{reserveUrl}}",
    footerText: "We hope to see you soon!",
  },
  reservation_reminder: {
    subject: "Reminder: Dinner tomorrow at {{restaurantName}}",
    heading: "See You Tomorrow!",
    body: "Hi {{guestName}},\n\nJust a friendly reminder about your reservation:\n\nDate: {{date}}\nTime: {{time}}\nParty size: {{partySize}}\n\nConfirmation code: {{confirmationCode}}",
    ctaText: "Manage Reservation",
    ctaUrl: "{{manageUrl}}",
    footerText: "Need to cancel? Please let us know as soon as possible so we can offer the table to another guest.",
  },
  reservation_request_received: {
    subject: "Reservation request received — {{restaurantName}}",
    heading: "Request Received",
    body: "Hi {{guestName}},\n\nWe've received your reservation request for {{date}} at {{time}} for {{partySize}} guests.\n\nWe'll review and confirm shortly. You'll receive another email once confirmed.",
    ctaText: "",
    ctaUrl: "",
    footerText: "Thank you for your patience!",
  },
  waitlist_added: {
    subject: "You're on the waitlist — {{restaurantName}}",
    heading: "You're on the List!",
    body: "Hi {{guestName}},\n\nYou've been added to our waitlist.\n\nParty size: {{partySize}}\nEstimated wait: {{estimatedWait}}\nPosition: #{{position}}\n\nWe'll notify you when your table is ready.",
    ctaText: "",
    ctaUrl: "",
    footerText: "Please stay nearby — we'll send another email when it's your turn.",
  },
  waitlist_ready: {
    subject: "Your table is ready! — {{restaurantName}}",
    heading: "Your Table is Ready!",
    body: "Hi {{guestName}},\n\nGreat news — your table for {{partySize}} is now ready!\n\nPlease check in with the host within the next 10 minutes.",
    ctaText: "",
    ctaUrl: "",
    footerText: "If you can no longer make it, please let us know.",
  },
  event_ticket_confirmation: {
    subject: "Tickets confirmed for {{eventName}} — {{restaurantName}}",
    heading: "You're In!",
    body: "Hi {{guestName}},\n\nYour tickets for {{eventName}} are confirmed!\n\nDate: {{eventDate}} at {{eventTime}}\nTickets: {{ticketCount}}\nTotal: {{ticketTotal}}\n\nTicket code(s):\n{{ticketCodes}}",
    ctaText: "View Tickets",
    ctaUrl: "{{ticketUrl}}",
    footerText: "Show this email or your confirmation at the door.",
  },
  password_reset: {
    subject: "Reset your password — {{restaurantName}}",
    heading: "Password Reset",
    body: "Hi {{userName}},\n\nWe received a request to reset your password. Click the button below to choose a new one.\n\nThis link expires in 1 hour.",
    ctaText: "Reset Password",
    ctaUrl: "{{resetUrl}}",
    footerText: "If you didn't request this, you can safely ignore this email.",
  },
};

function safeJson(value: string): Partial<TemplateData> | null {
  try {
    const parsed = JSON.parse(value) as Partial<TemplateData>;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function sanitizeTemplate(data: Partial<TemplateData> | null, fallback: TemplateData): TemplateData {
  if (!data) return fallback;
  return {
    subject: typeof data.subject === "string" ? data.subject : fallback.subject,
    heading: typeof data.heading === "string" ? data.heading : fallback.heading,
    body: typeof data.body === "string" ? data.body : fallback.body,
    ctaText: typeof data.ctaText === "string" ? data.ctaText : fallback.ctaText,
    ctaUrl: typeof data.ctaUrl === "string" ? data.ctaUrl : fallback.ctaUrl,
    footerText: typeof data.footerText === "string" ? data.footerText : fallback.footerText,
  };
}

export function getTemplateName(templateId: string): string {
  return TEMPLATE_NAMES[templateId] || templateId;
}

export function getTemplateIds(): string[] {
  return Object.keys(DEFAULT_TEMPLATES);
}

export async function getTemplate(templateId: string): Promise<TemplateData> {
  const fallback = DEFAULT_TEMPLATES[templateId] || DEFAULT_TEMPLATES.reservation_confirmed;
  const row = await prisma.setting.findUnique({ where: { key: `email_template_${templateId}` } });
  if (!row?.value) return fallback;
  return sanitizeTemplate(safeJson(row.value), fallback);
}

export async function getAllTemplates(): Promise<Record<string, TemplateRecord>> {
  const rows = await prisma.setting.findMany({ where: { key: { startsWith: "email_template_" } } });
  const custom = new Map<string, string>();
  for (const row of rows) {
    custom.set(row.key.replace(/^email_template_/, ""), row.value);
  }

  const out: Record<string, TemplateRecord> = {};
  for (const [id, fallback] of Object.entries(DEFAULT_TEMPLATES)) {
    const raw = custom.get(id);
    const merged = raw ? sanitizeTemplate(safeJson(raw), fallback) : fallback;
    out[id] = {
      ...merged,
      id,
      name: getTemplateName(id),
      customized: Boolean(raw),
    };
  }

  return out;
}

function replaceVariables(text: string, variables: Record<string, string>): string {
  return String(text || "").replace(/\{\{([\w.]+)\}\}/g, (_match, key: string) => {
    const value = variables[key];
    return value == null ? "" : String(value);
  });
}

function escapeHtml(text: string): string {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildEmailHtml(opts: {
  heading: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
  footerText: string;
  accentColor: string;
  restaurantName: string;
  logoUrl?: string;
}): string {
  const bodyBlocks = String(opts.body || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map(
      (line) =>
        `<p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">${escapeHtml(line)}</p>`,
    )
    .join("\n");

  const ctaBlock = opts.ctaText && opts.ctaUrl
    ? `
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:24px auto 0;">
        <tr>
          <td align="center" bgcolor="${escapeHtml(opts.accentColor)}" style="border-radius:6px;">
            <a href="${escapeHtml(opts.ctaUrl)}" target="_blank" rel="noreferrer" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${escapeHtml(opts.ctaText)}</a>
          </td>
        </tr>
      </table>
    `
    : "";

  const logoBlock = opts.logoUrl
    ? `<img src="${escapeHtml(opts.logoUrl)}" alt="${escapeHtml(opts.restaurantName)}" style="max-height:48px;margin:0 0 14px;" />`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(opts.heading)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08);">
          <tr>
            <td align="center" style="background:${escapeHtml(opts.accentColor)};padding:28px 24px;">
              ${logoBlock}
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;line-height:1.2;">${escapeHtml(opts.heading)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px 24px;">${bodyBlocks || '<p style="margin:0;color:#374151;font-size:15px;line-height:1.6;">&nbsp;</p>'}${ctaBlock}</td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background:#fafaf9;border-top:1px solid #e7e5e4;">
              <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.5;">${escapeHtml(opts.footerText)}</p>
            </td>
          </tr>
        </table>
        <p style="margin:12px 0 0;color:#94a3b8;font-size:11px;line-height:1.4;">${escapeHtml(opts.restaurantName)} · Powered by ReserveSit</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderTemplate(
  template: TemplateData,
  variables: Record<string, string>,
): { subject: string; html: string } {
  const subject = replaceVariables(template.subject, variables);
  const heading = replaceVariables(template.heading, variables);
  const body = replaceVariables(template.body, variables);
  const ctaText = replaceVariables(template.ctaText, variables);
  const ctaUrl = replaceVariables(template.ctaUrl, variables);
  const footerText = replaceVariables(template.footerText, variables);

  const html = buildEmailHtml({
    heading,
    body,
    ctaText,
    ctaUrl,
    footerText,
    accentColor: variables.accentColor || "#1e3a5f",
    restaurantName: variables.restaurantName || "Restaurant",
    logoUrl: variables.logoUrl || "",
  });

  return { subject, html };
}

export function getSampleVariables(extra?: Record<string, string>): Record<string, string> {
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return {
    restaurantName: "The Reef Restaurant",
    restaurantPhone: "(555) 123-4567",
    restaurantEmail: "hello@reef.restaurant",
    restaurantAddress: "123 Harbor Drive, Coastal City, CA",
    accentColor: "#1e3a5f",
    logoUrl: "",
    guestName: "Jane Smith",
    guestEmail: "jane@example.com",
    guestPhone: "+15551234567",
    date: "Friday, March 1",
    time: "7:00 PM",
    partySize: "4",
    confirmationCode: "RS-A1B2",
    manageUrl: `${appUrl}/reservation/manage?code=RS-A1B2`,
    reserveUrl: `${appUrl}/reserve/reef`,
    preOrderLine: "",
    specialRequests: "Window seat",
    estimatedWait: "25 minutes",
    position: "3",
    eventName: "Coastal Tasting Dinner",
    eventDate: "Saturday, March 15",
    eventTime: "6:30 PM",
    ticketCount: "2",
    ticketTotal: "$150.00",
    ticketUrl: `${appUrl}/events/coastal-tasting`,
    ticketCodes: "RS-EVT-A1B2",
    resetUrl: `${appUrl}/reset-password?token=sample-token`,
    userName: "Admin",
    ...extra,
  };
}
