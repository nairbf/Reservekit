import nodemailer from "nodemailer";
import { prisma } from "./db";

async function getEmailConfig() {
  const keys = ["smtpHost", "smtpPort", "smtpUser", "smtpPass", "smtpFrom", "restaurantName"];
  const rows = await prisma.setting.findMany({ where: { key: { in: keys } } });
  const m: Record<string, string> = {};
  for (const r of rows) m[r.key] = r.value;
  return m;
}

export async function sendEmail(p: { to: string; subject: string; body: string; reservationId?: number; messageType: string }) {
  const c = await getEmailConfig();
  if (!c.smtpHost || !c.smtpUser) {
    console.log(`[EMAIL SKIP] No SMTP. Would send to ${p.to}: ${p.subject}`);
    return;
  }
  try {
    const t = nodemailer.createTransport({ host: c.smtpHost, port: parseInt(c.smtpPort || "587"), secure: c.smtpPort === "465", auth: { user: c.smtpUser, pass: c.smtpPass } });
    await t.sendMail({ from: `"${c.restaurantName || "Restaurant"}" <${c.smtpFrom || c.smtpUser}>`, to: p.to, subject: p.subject, text: p.body });
    await prisma.notificationLog.create({ data: { reservationId: p.reservationId, channel: "email", recipient: p.to, messageType: p.messageType, body: p.body, status: "sent" } });
  } catch (err) {
    console.error("[EMAIL ERROR]", err);
    await prisma.notificationLog.create({ data: { reservationId: p.reservationId, channel: "email", recipient: p.to, messageType: p.messageType, body: p.body, status: "failed" } });
  }
}
