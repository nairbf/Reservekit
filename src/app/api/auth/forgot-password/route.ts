import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createPasswordResetToken } from "@/lib/auth";
import { sendNotification } from "@/lib/send-notification";

function genericResponse(extra?: Record<string, unknown>) {
  return NextResponse.json({
    ok: true,
    message: "If an account exists for that email, a reset link has been sent.",
    ...extra,
  });
}

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return genericResponse();

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user || !user.isActive) return genericResponse();

  const token = createPasswordResetToken({
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
  });
  const appUrl = process.env.APP_URL || req.nextUrl.origin || "http://localhost:3000";
  const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;

  await sendNotification({
    templateId: "password_reset",
    to: user.email,
    messageType: "password_reset_request",
    variables: {
      userName: user.name || "there",
      resetUrl,
    },
    force: true,
  });

  if (process.env.NODE_ENV !== "production") {
    return genericResponse({ debugResetUrl: resetUrl });
  }
  return genericResponse();
}
