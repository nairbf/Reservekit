import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getSessionFromRequest } from "@/lib/customer-auth";

export const runtime = "nodejs";

type DomainRequestType = "connect" | "register";

interface DomainRequestBody {
  type?: DomainRequestType;
  domain?: string;
  restaurantSlug?: string;
}

function isValidDomain(value: string): boolean {
  const domain = value.trim().toLowerCase();
  const pattern = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
  return pattern.test(domain) && domain.length <= 253;
}

function sanitizeSlug(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 60);
}

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: DomainRequestBody;
  try {
    body = (await request.json()) as DomainRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const type = body.type;
  const domain = String(body.domain || "").trim().toLowerCase();
  const restaurantSlug = sanitizeSlug(body.restaurantSlug) || "unknown";

  if (type !== "connect" && type !== "register") {
    return NextResponse.json({ error: "Type must be 'connect' or 'register'" }, { status: 400 });
  }

  if (!isValidDomain(domain)) {
    return NextResponse.json({ error: "Please enter a valid domain" }, { status: 400 });
  }

  if (!process.env.RESEND_API_KEY) {
    console.warn("[domain-request] RESEND_API_KEY is not configured; email notification skipped.");
    return NextResponse.json({
      ok: true,
      message: "We've received your request and will be in touch within 24 hours.",
      warning: "Email notification skipped (missing RESEND_API_KEY).",
    });
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "ReserveSit <reservations@reservesit.com>",
      to: "support@reservesit.com",
      subject: `Domain Request: ${type === "register" ? "New Registration" : "Connect Existing"} — ${domain}`,
      text: [
        `Customer name: ${session.name}`,
        `Customer email: ${session.email}`,
        `Restaurant slug: ${restaurantSlug}`,
        `Request type: ${type}`,
        `Domain: ${domain}`,
        `Requested at: ${new Date().toISOString()}`,
        "",
        "Please process this request.",
      ].join("\n"),
    });

    return NextResponse.json({
      ok: true,
      message: "We've received your request and will be in touch within 24 hours.",
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    console.error("[domain-request] Failed to send notification:", detail);
    return NextResponse.json(
      { error: "Could not submit domain request. Please try again or contact support@reservesit.com." },
      { status: 500 },
    );
  }
}
