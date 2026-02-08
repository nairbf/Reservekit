import { prisma } from "./db";
import { isModuleActive } from "./license";

async function getSmsSettings() {
  const active = await isModuleActive("sms");
  if (!active) return null;
  const keys = ["twilioSid", "twilioToken", "twilioPhone"];
  const rows = await prisma.setting.findMany({ where: { key: { in: keys } } });
  const m: Record<string, string> = {};
  for (const r of rows) m[r.key] = r.value;
  if (!m.twilioSid || !m.twilioToken || !m.twilioPhone) return null;
  return m;
}

export async function sendSms(p: { to: string; body: string; reservationId?: number; messageType: string }): Promise<boolean> {
  const s = await getSmsSettings();
  if (!s) return false;
  const clean = p.to.replace(/[^\d+]/g, "");
  if (clean.length < 10) return false;
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${s.twilioSid}/Messages.json`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: "Basic " + Buffer.from(`${s.twilioSid}:${s.twilioToken}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: clean, From: s.twilioPhone, Body: p.body }),
    });
    await prisma.notificationLog.create({ data: { reservationId: p.reservationId, channel: "sms", recipient: clean, messageType: p.messageType, body: p.body, status: res.ok ? "sent" : "failed" } });
    return res.ok;
  } catch (err) {
    console.error("[SMS ERROR]", err);
    await prisma.notificationLog.create({ data: { reservationId: p.reservationId, channel: "sms", recipient: p.to, messageType: p.messageType, body: p.body, status: "failed" } });
    return false;
  }
}
