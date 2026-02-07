import { sendEmail } from "./email";
import { prisma } from "./db";

interface Res { id: number; code: string; guestName: string; guestPhone: string; guestEmail: string | null; partySize: number; date: string; time: string }

function fmt(t: string) { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; }
async function rname() { return (await prisma.setting.findUnique({ where: { key: "restaurantName" } }))?.value || "the restaurant"; }

export async function notifyRequestReceived(r: Res) {
  if (!r.guestEmail) return;
  const n = await rname();
  await sendEmail({ to: r.guestEmail, subject: `Reservation request received — ${n}`, body: `Hi ${r.guestName},\n\nWe received your request:\nDate: ${r.date}\nTime: ${fmt(r.time)}\nParty: ${r.partySize}\nRef: ${r.code}\n\nWe'll confirm shortly.\n\n— ${n}`, reservationId: r.id, messageType: "request_received" });
}

export async function notifyApproved(r: Res) {
  if (!r.guestEmail) return;
  const n = await rname();
  await sendEmail({ to: r.guestEmail, subject: `Reservation confirmed — ${n}`, body: `Hi ${r.guestName},\n\nYour reservation is confirmed!\nDate: ${r.date}\nTime: ${fmt(r.time)}\nParty: ${r.partySize}\nRef: ${r.code}\n\nSee you there!\n\n— ${n}`, reservationId: r.id, messageType: "approved" });
}

export async function notifyDeclined(r: Res) {
  if (!r.guestEmail) return;
  const n = await rname();
  await sendEmail({ to: r.guestEmail, subject: `Reservation update — ${n}`, body: `Hi ${r.guestName},\n\nWe're unable to accommodate ${r.date} at ${fmt(r.time)}.\nPlease try another date or call us.\n\n— ${n}`, reservationId: r.id, messageType: "declined" });
}

export async function notifyCancelled(r: Res) {
  if (!r.guestEmail) return;
  const n = await rname();
  await sendEmail({ to: r.guestEmail, subject: `Reservation cancelled — ${n}`, body: `Hi ${r.guestName},\n\nYour reservation for ${r.date} at ${fmt(r.time)} has been cancelled.\nRef: ${r.code}\n\n— ${n}`, reservationId: r.id, messageType: "cancelled" });
}
