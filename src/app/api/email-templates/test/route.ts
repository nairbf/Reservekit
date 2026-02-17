import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sendNotification } from "@/lib/send-notification";

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { templateId?: string };
  const templateId = String(body?.templateId || "").trim();
  if (!templateId) {
    return NextResponse.json({ error: "templateId is required" }, { status: 400 });
  }

  const result = await sendNotification({
    templateId,
    to: session.email,
    force: true,
    messageType: `${templateId}_test`,
  });

  if (!result.success) {
    return NextResponse.json({ error: "Failed to send test email", details: String(result.error || "unknown") }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: result.id || null, to: session.email });
}
