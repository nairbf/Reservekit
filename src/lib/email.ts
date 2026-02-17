import { Resend } from "resend";
import { prisma } from "@/lib/db";

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  body?: string;
  text?: string;
  replyTo?: string;
  slug?: string;
  fromName?: string;
  reservationId?: number;
  messageType?: string;
  attachments?: EmailAttachment[];
}

function toHtmlFromBody(body: string): string {
  const lines = String(body || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">${line}</p>`)
    .join("\n");

  return `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">${lines || "<p style='margin:0;color:#374151;font-size:15px;'>No message body.</p>"}</div></body></html>`;
}

function formatToLog(to: string | string[]): string {
  return Array.isArray(to) ? to.join(",") : to;
}

function cleanEnv(name: string, fallback = ""): string {
  const value = process.env[name];
  if (!value) return fallback;
  return value.replace(/^['"]|['"]$/g, "");
}

export async function sendEmail(options: SendEmailOptions) {
  const toList = Array.isArray(options.to) ? options.to : [options.to];
  const to = toList.filter(Boolean);
  if (to.length === 0) {
    return { success: false, error: "No recipients" };
  }

  const apiKey = cleanEnv("RESEND_API_KEY");
  if (!apiKey) {
    console.log(`[EMAIL SKIP] No RESEND_API_KEY. Would send to ${formatToLog(to)}: ${options.subject}`);
    return { success: false, error: "No API key configured" };
  }

  const senderDomain = cleanEnv("SENDER_DOMAIN", "reservesit.com");
  const fromName = options.fromName || cleanEnv("RESTAURANT_NAME", "ReserveSit");
  const from = `${fromName} <reservations@${senderDomain}>`;

  const html = options.html || toHtmlFromBody(options.body || options.text || "");
  const text = options.text || options.body || "";

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: options.subject,
      html,
      text: text || undefined,
      replyTo: options.replyTo || undefined,
      attachments: options.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType,
      })),
    });

    if (error) {
      console.error("[EMAIL ERROR]", error);
      if (options.messageType) {
        await prisma.notificationLog.create({
          data: {
            reservationId: options.reservationId,
            channel: "email",
            recipient: formatToLog(to),
            messageType: options.messageType,
            body: text || options.subject,
            status: "failed",
          },
        });
      }
      return { success: false, error };
    }

    console.log(`[EMAIL SENT] to=${formatToLog(to)} subject="${options.subject}" id=${data?.id || ""}`);

    if (options.messageType) {
      await prisma.notificationLog.create({
        data: {
          reservationId: options.reservationId,
          channel: "email",
          recipient: formatToLog(to),
          messageType: options.messageType,
          body: text || options.subject,
          status: "sent",
        },
      });
    }

    return { success: true, id: data?.id || null };
  } catch (error) {
    console.error("[EMAIL ERROR]", error);
    if (options.messageType) {
      await prisma.notificationLog.create({
        data: {
          reservationId: options.reservationId,
          channel: "email",
          recipient: formatToLog(to),
          messageType: options.messageType,
          body: text || options.subject,
          status: "failed",
        },
      });
    }
    return { success: false, error };
  }
}
