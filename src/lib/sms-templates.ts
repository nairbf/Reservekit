import { prisma } from "./db";

async function rname() { return (await prisma.setting.findUnique({ where: { key: "restaurantName" } }))?.value || "Restaurant"; }
function fmt(t: string) { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; }
function manageLink() { const appUrl = process.env.APP_URL || "http://localhost:3000"; return `${appUrl}/reservation/manage`; }

interface R { code: string; guestName: string; partySize: number; date: string; time: string; originalTime?: string | null }

export async function smsRequestReceived(r: R) { const n = await rname(); return `${n}: Hi ${r.guestName}! We received your reservation for ${r.date} at ${fmt(r.time)}, party of ${r.partySize}. We'll confirm shortly. Ref: ${r.code}. Manage: ${manageLink()}`; }
export async function smsApproved(r: R) { const n = await rname(); return `${n}: Confirmed! ${r.date} at ${fmt(r.time)}, party of ${r.partySize}. Ref: ${r.code}. Reply CANCEL to cancel. Manage: ${manageLink()}`; }
export async function smsDeclined(r: R) { const n = await rname(); return `${n}: Sorry ${r.guestName}, we can't accommodate ${r.date} at ${fmt(r.time)}. Please try another time. Manage: ${manageLink()}`; }
export async function smsCancelled(r: R) { const n = await rname(); return `${n}: Your reservation for ${r.date} at ${fmt(r.time)} has been cancelled. Ref: ${r.code}. Manage: ${manageLink()}`; }
export async function smsReminder(r: R) { const n = await rname(); return `${n}: Reminder — your reservation is tomorrow! ${r.date} at ${fmt(r.time)}, party of ${r.partySize}. Reply CANCEL if plans changed. Manage: ${manageLink()}`; }
