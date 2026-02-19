import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";

type DemoRequestBody = {
  name?: string;
  contactName?: string;
  email?: string;
  restaurantName?: string;
  phone?: string;
  message?: string;
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
  const body = (await req.json().catch(() => ({}))) as DemoRequestBody;

  const restaurantName = String(body.restaurantName || "").trim();
  const contactName = String(body.contactName || body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const phone = String(body.phone || "").trim();
  const message = String(body.message || "").trim();

  if (!restaurantName || !contactName || !email) {
    return NextResponse.json({ error: "Restaurant name, contact name, and email are required" }, { status: 400 });
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.error("[demo-request] RESEND_API_KEY not configured");
    return NextResponse.json({ error: "Email not configured" }, { status: 500 });
  }

  const resend = new Resend(apiKey);
  const safeRestaurantName = sanitizeHtml(restaurantName);
  const safeContactName = sanitizeHtml(contactName);
  const safeEmail = sanitizeHtml(email);
  const safePhone = sanitizeHtml(phone || "Not provided");
  const safeMessage = sanitizeHtml(message || "No message provided").replace(/\n/g, "<br>");

  try {
    await resend.emails.send({
      from: "ReserveSit Support <support@reservesit.com>",
      to: "support@reservesit.com",
      subject: `[Demo Request] ${safeRestaurantName}`,
      html: `
        <h3>New Demo Request</h3>
        <p><strong>Restaurant:</strong> ${safeRestaurantName}</p>
        <p><strong>Contact:</strong> ${safeContactName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Phone:</strong> ${safePhone}</p>
        <hr>
        <p>${safeMessage}</p>
      `,
    });

    await resend.emails.send({
      from: "ReserveSit Support <support@reservesit.com>",
      to: email,
      subject: "We received your demo request",
      html: `
        <p>Hi ${safeContactName},</p>
        <p>Thanks for requesting a ReserveSit demo for ${safeRestaurantName}.</p>
        <p>We will reach out within 24 hours to schedule your walkthrough.</p>
        <p>- The ReserveSit Team</p>
      `,
    });

    return NextResponse.json({ success: true, message: "Demo request submitted." });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    console.error("[demo-request] Email send failed:", detail);
    return NextResponse.json({ error: "Could not submit demo request" }, { status: 500 });
  }
}
