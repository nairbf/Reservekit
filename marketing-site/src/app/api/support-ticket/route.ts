import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getServerEnv } from "@/lib/server-env";

export const runtime = "nodejs";

type SupportTicketBody = {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
  priority?: string;
};

function sanitizeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as SupportTicketBody;
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const subject = String(body.subject || "").trim();
  const message = String(body.message || "").trim();
  const priority = String(body.priority || "normal").trim().toLowerCase();

  if (!name || !email || !subject || !message) {
    return NextResponse.json({ error: "All fields required" }, { status: 400 });
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  const apiKey = getServerEnv("RESEND_API_KEY");
  if (!apiKey) {
    console.error("[support-ticket] RESEND_API_KEY not configured");
    return NextResponse.json({ error: "Email not configured" }, { status: 500 });
  }

  const resend = new Resend(apiKey);
  const safeName = sanitizeHtml(name);
  const safeEmail = sanitizeHtml(email);
  const safeSubject = sanitizeHtml(subject);
  const safePriority = sanitizeHtml(priority || "normal");
  const safeMessage = sanitizeHtml(message).replace(/\n/g, "<br>");

  try {
    await resend.emails.send({
      from: "ReserveSit Support <support@reservesit.com>",
      to: "support@reservesit.com",
      subject: `[Support Ticket] ${safePriority}: ${safeSubject}`,
      html: `
        <h3>New Support Ticket</h3>
        <p><strong>From:</strong> ${safeName} (${safeEmail})</p>
        <p><strong>Priority:</strong> ${safePriority}</p>
        <p><strong>Subject:</strong> ${safeSubject}</p>
        <hr>
        <p>${safeMessage}</p>
      `,
    });

    await resend.emails.send({
      from: "ReserveSit Support <support@reservesit.com>",
      to: email,
      subject: `Re: ${subject} - We received your ticket`,
      html: `
        <p>Hi ${safeName},</p>
        <p>We received your support ticket and will respond within 24 hours.</p>
        <p><strong>Subject:</strong> ${safeSubject}</p>
        <p><strong>Your message:</strong></p>
        <blockquote>${safeMessage}</blockquote>
        <p>- The ReserveSit Team</p>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    console.error("[support-ticket] Email send failed:", detail);
    return NextResponse.json({ error: "Could not send ticket email" }, { status: 500 });
  }
}
