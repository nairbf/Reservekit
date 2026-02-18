import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { verifyPasswordResetToken } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { checkPasswordResetRate, getClientIp, tooManyRequests } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = checkPasswordResetRate(ip);
  if (!limit.allowed) return tooManyRequests(limit.resetAt);

  const { token, password } = await req.json();
  const nextPassword = String(password || "");

  if (!token || nextPassword.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  let payload: { userId: number; email: string; pwdSig: string };
  try {
    payload = verifyPasswordResetToken(String(token));
  } catch {
    return NextResponse.json({ error: "Reset link is invalid or expired." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || !user.isActive || user.email !== payload.email) {
    return NextResponse.json({ error: "Reset link is invalid or expired." }, { status: 400 });
  }

  if (user.passwordHash.slice(-16) !== payload.pwdSig) {
    return NextResponse.json({ error: "Reset link has already been used." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(nextPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  await sendEmail({
    to: user.email,
    subject: "Your ReserveSit password was changed",
    messageType: "password_reset_success",
    body: [
      "Your password has been successfully updated.",
      "",
      "If you did not make this change, contact your administrator immediately.",
    ].join("\n"),
  });

  return NextResponse.json({ ok: true });
}
