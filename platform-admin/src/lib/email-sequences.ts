import { Resend } from "resend";
import { prisma } from "@/lib/db";

export interface PurchaseInfo {
  restaurantId: string;
  ownerName: string;
  ownerEmail: string;
  restaurantName: string;
  plan: string;
  licenseKey: string;
  instanceUrl: string;
  hosted: boolean;
  loginEmail?: string;
  loginPassword?: string;
}

type SequenceStatus = "pending" | "sent" | "failed" | "cancelled";
export type SequenceTemplateId = "welcome" | "setup_checkin" | "tips";

const EMAIL_FROM = process.env.PLATFORM_EMAIL_FROM || "ReserveSit <reservations@reservesit.com>";

function toReserveSlug(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "reserve";
}

const PURCHASE_SEQUENCE = [
  {
    step: 0,
    delayHours: 0,
    subject: (info: PurchaseInfo) => `Welcome to ReserveSit, ${info.ownerName}!`,
    body: (info: PurchaseInfo) => {
      const loginEmail = info.loginEmail || info.ownerEmail;
      const credentialsSection = info.hosted && info.loginPassword
        ? `
Your Dashboard Access:
- URL: ${info.instanceUrl}
- Email: ${loginEmail}
- Password: ${info.loginPassword}

You can change your password after logging in.
`
        : "";

      return `
Hi ${info.ownerName},

Thank you for purchasing ReserveSit ${info.plan} for ${info.restaurantName}!

Here's everything you need to get started:

${info.hosted ? `Your Dashboard: ${info.instanceUrl}/login` : `Your License Key: ${info.licenseKey}`}

${credentialsSection}

${info.hosted ? `Your dashboard is live and ready. Use the credentials above to log in and complete your setup wizard — it only takes a few minutes.` : `Please follow the self-hosting guide included in your welcome package to install ReserveSit on your server.`}

Quick Start Checklist:
1. Log in to your dashboard
2. Complete the setup wizard (restaurant name, hours, tables)
3. Configure your notification email in Settings
4. Make a test reservation to see how it works
5. Share your booking link with guests

Need help? Reply to this email or contact support@reservesit.com.

Best,
The ReserveSit Team
    `.trim();
    },
  },
  {
    step: 1,
    delayHours: 24,
    subject: (info: PurchaseInfo) => `How's your ReserveSit setup going, ${info.ownerName}?`,
    body: (info: PurchaseInfo) => `
Hi ${info.ownerName},

Just checking in — have you had a chance to set up ${info.restaurantName} on ReserveSit?

If you've already completed the setup wizard, great! Here are a few things to double-check:

- Tables: Make sure all your tables are added with correct capacities
- Hours: Verify your opening hours for each day of the week
- Notifications: Set your notification email so you get alerts for new reservations
- Test booking: Try making a reservation yourself to see the guest experience

${info.hosted ? `Your dashboard: ${info.instanceUrl}/login` : ""}

If you ran into any issues or have questions, just reply to this email — we're happy to help.

Best,
The ReserveSit Team
    `.trim(),
  },
  {
    step: 2,
    delayHours: 168,
    subject: () => "5 tips to get the most out of ReserveSit",
    body: (info: PurchaseInfo) => `
Hi ${info.ownerName},

You've had ${info.restaurantName} on ReserveSit for a week now. Here are 5 tips to make the most of it:

1. Upload Your Menu
   Go to Dashboard > Menu and upload your menu as images or PDFs. Guests will see it on your landing page.

2. Customize Your Landing Page
   In Settings, add your logo, accent color, tagline, and hero image to make your booking page match your brand.

3. Set Up Email Templates
   In Settings > Email Templates, customize the confirmation and reminder emails your guests receive.

4. Use the Floor Plan
   If you have the floor plan feature, drag and drop your tables to match your actual layout. It makes seating much faster.

5. Share Your Booking Link
   Your guests can book at: ${info.hosted ? `${info.instanceUrl}/reserve/${toReserveSlug(info.restaurantName)}` : "your-domain.com/reserve/your-slug"}
   Add this link to your website, Google Business Profile, and social media.

Questions? We're always here at support@reservesit.com.

Best,
The ReserveSit Team
    `.trim(),
  },
] as const;

const TEMPLATE_STEP_MAP: Record<SequenceTemplateId, number> = {
  welcome: 0,
  setup_checkin: 1,
  tips: 2,
};

function getResendClient() {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  return new Resend(key);
}

export function getTemplateContent(templateId: SequenceTemplateId, info: PurchaseInfo): { subject: string; body: string; step: number } {
  const step = TEMPLATE_STEP_MAP[templateId];
  const template = PURCHASE_SEQUENCE[step];
  return {
    subject: template.subject(info),
    body: template.body(info),
    step,
  };
}

export async function sendDirectEmail(input: { to: string; subject: string; body: string }) {
  const resend = getResendClient();
  if (!resend) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  await resend.emails.send({
    from: EMAIL_FROM,
    to: input.to,
    subject: input.subject,
    text: input.body,
  });
}

export async function createPurchaseSequence(info: PurchaseInfo) {
  const now = new Date();
  for (const template of PURCHASE_SEQUENCE) {
    const scheduledAt = template.step === 0
      ? new Date(Date.now() + 60 * 1000)
      : new Date(now.getTime() + template.delayHours * 60 * 60 * 1000);
    await prisma.emailSequenceEvent.create({
      data: {
        restaurantId: info.restaurantId,
        trigger: "purchase",
        sequenceStep: template.step,
        scheduledAt,
        emailTo: info.ownerEmail,
        emailSubject: template.subject(info),
        emailBody: template.body(info),
        status: "pending",
      },
    });
  }
}

export async function sendSequenceEvent(eventId: string) {
  const event = await prisma.emailSequenceEvent.findUnique({
    where: { id: eventId },
    include: { restaurant: true },
  });
  if (!event) throw new Error("Sequence event not found");
  if (event.status === "cancelled") throw new Error("Cannot send a cancelled event");

  if (event.restaurant.status === "CANCELLED") {
    await prisma.emailSequenceEvent.update({
      where: { id: event.id },
      data: { status: "cancelled" },
    });
    return { status: "cancelled" as SequenceStatus };
  }

  try {
    await sendDirectEmail({
      to: event.emailTo,
      subject: event.emailSubject,
      body: event.emailBody,
    });
  } catch (error) {
    await prisma.emailSequenceEvent.update({
      where: { id: event.id },
      data: { status: "failed" },
    });
    throw error;
  }

  await prisma.emailSequenceEvent.update({
    where: { id: event.id },
    data: {
      status: "sent",
      sentAt: new Date(),
    },
  });
  return { status: "sent" as SequenceStatus };
}

export async function processPendingEmails() {
  const now = new Date();
  const pending = await prisma.emailSequenceEvent.findMany({
    where: {
      status: "pending",
      scheduledAt: { lte: now },
    },
    include: { restaurant: true },
    take: 20,
    orderBy: { scheduledAt: "asc" },
  });

  let sent = 0;
  let failed = 0;
  let cancelled = 0;

  for (const event of pending) {
    if (event.restaurant.status === "CANCELLED") {
      await prisma.emailSequenceEvent.update({
        where: { id: event.id },
        data: { status: "cancelled" },
      });
      cancelled += 1;
      continue;
    }

    try {
      await sendSequenceEvent(event.id);
      sent += 1;
    } catch (error) {
      console.error(`[EMAIL SEQUENCE] Failed to send event ${event.id} to ${event.emailTo}:`, error);
      failed += 1;
    }
  }

  return { sent, failed, cancelled, total: pending.length };
}

export async function cancelPendingSequenceEvents(restaurantId: string) {
  const result = await prisma.emailSequenceEvent.updateMany({
    where: {
      restaurantId,
      status: "pending",
    },
    data: {
      status: "cancelled",
    },
  });
  return result.count;
}
