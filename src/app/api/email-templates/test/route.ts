import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sendNotification } from "@/lib/send-notification";
import { checkEmailTestRate, getClientIp, tooManyRequests } from "@/lib/rate-limit";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = checkEmailTestRate(ip);
  if (!limit.allowed) return tooManyRequests(limit.resetAt);

  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { templateId?: string; to?: string };
  const templateId = String(body?.templateId || "").trim();
  if (!templateId) {
    return NextResponse.json({ error: "templateId is required" }, { status: 400 });
  }
  const requestedTo = String(body?.to || "").trim();
  const recipientEmail = requestedTo && isValidEmail(requestedTo) ? requestedTo : session.email;

  const result = await sendNotification({
    templateId,
    to: recipientEmail,
    force: true,
    messageType: `${templateId}_test`,
  });

  if (!result.success) {
    const details =
      typeof result.error === "string"
        ? result.error
        : result.error && typeof result.error === "object" && "message" in result.error
          ? String((result.error as { message?: unknown }).message || "")
          : String(result.error || "Failed to send");
    return NextResponse.json(
      {
        success: false,
        error: details || "Failed to send",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    sentTo: recipientEmail,
    message: `Test email sent to ${recipientEmail}`,
    id: result.id || null,
  });
}
