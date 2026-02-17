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
    sentTo: session.email,
    message: `Test email sent to ${session.email}`,
    id: result.id || null,
  });
}
