import { sendEmail } from "./email";
import { sendSms } from "./sms";
import * as smsT from "./sms-templates";
import { prisma } from "./db";
import { generateICS } from "./calendar";
import { getSettings } from "./settings";

interface Res { id: number; code: string; guestName: string; guestPhone: string; guestEmail: string | null; partySize: number; date: string; time: string; durationMin?: number; originalTime?: string | null }

function fmt(t: string) { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; }
async function rname() { return (await prisma.setting.findUnique({ where: { key: "restaurantName" } }))?.value || "the restaurant"; }
function manageLink() { const appUrl = process.env.APP_URL || "http://localhost:3000"; return `${appUrl}/reservation/manage`; }
function preorderLink(code: string) { const appUrl = process.env.APP_URL || "http://localhost:3000"; return `${appUrl}/preorder/${code}`; }

async function expressDiningEmailLine(reservationId: number, code: string) {
  const settings = await getSettings();
  if (!settings.expressDiningEnabled) return "";
  const preOrder = await prisma.preOrder.findUnique({ where: { reservationId } });
  if (preOrder && preOrder.status !== "cancelled") {
    return "\nYour starters & drinks are confirmed! We'll have them ready when you arrive.";
  }
  return `\nPre-order your starters & drinks: ${preorderLink(code)}`;
}

export async function notifyRequestReceived(r: Res) {
  if (r.guestEmail) { const n = await rname(); await sendEmail({ to: r.guestEmail, subject: `Reservation request received — ${n}`, body: `Hi ${r.guestName},\n\nWe received your request:\nDate: ${r.date}\nTime: ${fmt(r.time)}\nParty: ${r.partySize}\nRef: ${r.code}\n\nWe'll confirm shortly.\n\nManage your reservation: ${manageLink()}\n\n— ${n}`, reservationId: r.id, messageType: "request_received" }); }
  if (r.guestPhone) { const body = await smsT.smsRequestReceived(r); await sendSms({ to: r.guestPhone, body, reservationId: r.id, messageType: "request_received" }); }
}

export async function notifyApproved(r: Res) {
  if (r.guestEmail) {
    const n = await rname();
    const expressLine = await expressDiningEmailLine(r.id, r.code);
    let attachments: Array<{ filename: string; content: string; contentType: string }> = [];
    try {
      const ics = await generateICS({
        id: r.id,
        code: r.code,
        guestName: r.guestName,
        partySize: r.partySize,
        date: r.date,
        time: r.time,
        durationMin: (r as { durationMin?: number }).durationMin || 90,
      });
      attachments = [{ filename: "reservation.ics", content: ics, contentType: "text/calendar" }];
    } catch (err) {
      console.error("[ICS ATTACH ERROR]", err);
    }
    await sendEmail({
      to: r.guestEmail,
      subject: `Reservation confirmed — ${n}`,
      body: `Hi ${r.guestName},\n\nYour reservation is confirmed!\nDate: ${r.date}\nTime: ${fmt(r.time)}\nParty: ${r.partySize}\nRef: ${r.code}\n\nSee you there!\n\nManage your reservation: ${manageLink()}${expressLine}\n\n— ${n}`,
      reservationId: r.id,
      messageType: "approved",
      attachments,
    });
  }
  if (r.guestPhone) { const body = await smsT.smsApproved(r); await sendSms({ to: r.guestPhone, body, reservationId: r.id, messageType: "approved" }); }
}

export async function notifyDeclined(r: Res) {
  if (r.guestEmail) { const n = await rname(); await sendEmail({ to: r.guestEmail, subject: `Reservation update — ${n}`, body: `Hi ${r.guestName},\n\nWe're unable to accommodate ${r.date} at ${fmt(r.time)}.\nPlease try another date or call us.\n\nManage your reservation: ${manageLink()}\n\n— ${n}`, reservationId: r.id, messageType: "declined" }); }
  if (r.guestPhone) { const body = await smsT.smsDeclined(r); await sendSms({ to: r.guestPhone, body, reservationId: r.id, messageType: "declined" }); }
}

export async function notifyCancelled(r: Res) {
  if (r.guestEmail) { const n = await rname(); await sendEmail({ to: r.guestEmail, subject: `Reservation cancelled — ${n}`, body: `Hi ${r.guestName},\n\nYour reservation for ${r.date} at ${fmt(r.time)} has been cancelled.\nRef: ${r.code}\n\nManage your reservation: ${manageLink()}\n\n— ${n}`, reservationId: r.id, messageType: "cancelled" }); }
  if (r.guestPhone) { const body = await smsT.smsCancelled(r); await sendSms({ to: r.guestPhone, body, reservationId: r.id, messageType: "cancelled" }); }
}
