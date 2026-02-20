import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateDailyPrep, type DailyPrepSummary } from "@/lib/smart/daily-prep";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeHtml(value: string): string {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatTime12(value: string): string {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return value;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return value;
  const h = hour % 12 || 12;
  return `${h}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

function buildDailyPrepEmail(summary: DailyPrepSummary): string {
  let html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; color: #1e293b;">
      <h1 style="margin: 0 0 8px; font-size: 20px;">📋 Tonight's Prep Summary</h1>
      <p style="margin: 0 0 16px; color: #64748b; font-size: 14px;">${escapeHtml(summary.restaurantName)} — ${escapeHtml(summary.date)}</p>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 18px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="font-size: 24px; font-weight: 700; color: #0f172a;">${summary.totalReservations}</td>
            <td style="font-size: 24px; font-weight: 700; color: #0f172a;">${summary.totalCovers}</td>
            <td style="font-size: 24px; font-weight: 700; color: #0f172a;">${summary.newGuests}</td>
          </tr>
          <tr>
            <td style="font-size: 12px; color: #64748b;">Reservations</td>
            <td style="font-size: 12px; color: #64748b;">Covers</td>
            <td style="font-size: 12px; color: #64748b;">First-Timers</td>
          </tr>
        </table>
      </div>
  `;

  if (summary.vipGuests.length > 0) {
    html += `<h3 style="font-size: 14px; margin: 16px 0 8px; color: #7c3aed;">👑 VIP Guests Tonight</h3><ul style="padding-left: 18px; margin: 0;">`;
    for (const guest of summary.vipGuests) {
      html += `<li style="margin: 4px 0; font-size: 14px; color: #334155;">${escapeHtml(guest.name)} — party of ${guest.partySize} at ${escapeHtml(formatTime12(guest.time))} (${guest.visits} visits)</li>`;
    }
    html += "</ul>";
  }

  if (summary.largeParties.length > 0) {
    html += `<h3 style="font-size: 14px; margin: 16px 0 8px; color: #1e293b;">🍽️ Large Parties</h3><ul style="padding-left: 18px; margin: 0;">`;
    for (const guest of summary.largeParties) {
      html += `<li style="margin: 4px 0; font-size: 14px; color: #334155;">${escapeHtml(guest.name)} — party of ${guest.partySize} at ${escapeHtml(formatTime12(guest.time))}</li>`;
    }
    html += "</ul>";
  }

  if (summary.highRiskNoShows.length > 0) {
    html += `<h3 style="font-size: 14px; margin: 16px 0 8px; color: #dc2626;">⚠️ No-Show Risk</h3><ul style="padding-left: 18px; margin: 0;">`;
    for (const reservation of summary.highRiskNoShows) {
      html += `<li style="margin: 4px 0; font-size: 14px; color: #334155;">${escapeHtml(reservation.name)} at ${escapeHtml(formatTime12(reservation.time))} — ${escapeHtml(reservation.reasons.join(", "))}</li>`;
    }
    html += "</ul>";
  }

  if (summary.peakSlots.length > 0) {
    html += `<h3 style="font-size: 14px; margin: 16px 0 8px; color: #1e293b;">📊 Busiest Time Slots</h3><ul style="padding-left: 18px; margin: 0;">`;
    for (const slot of summary.peakSlots) {
      const utilization = slot.capacity > 0 ? Math.round((slot.reservations / slot.capacity) * 100) : 0;
      html += `<li style="margin: 4px 0; font-size: 14px; color: #334155;">${escapeHtml(formatTime12(slot.time))} — ${slot.reservations} reservations (${utilization}% of ${slot.capacity} tables)</li>`;
    }
    html += "</ul>";
  }

  html += `
      <p style="margin-top: 20px; padding-top: 12px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px;">
        Sent by ReserveSit Smart Features. You can disable this in Settings → Smart Features.
      </p>
    </div>
  `;

  return html;
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET || "";
  const provided = req.headers.get("x-cron-secret") || "";
  if (secret && provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [featureRow, emailRows] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "smartDailyPrep" } }),
    prisma.setting.findMany({
      where: {
        key: {
          in: ["notificationEmail", "staffNotificationEmail", "contactEmail"],
        },
      },
    }),
  ]);

  if (featureRow?.value === "false") {
    return NextResponse.json({ skipped: true, reason: "Daily prep disabled" });
  }

  const settingsMap = Object.fromEntries(emailRows.map((row) => [row.key, row.value]));
  const adminEmail = String(
    settingsMap.notificationEmail || settingsMap.staffNotificationEmail || settingsMap.contactEmail || "",
  ).trim();

  if (!adminEmail) {
    return NextResponse.json({ skipped: true, reason: "No notification email configured" });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ skipped: true, reason: "RESEND_API_KEY not configured" });
  }

  const summary = await generateDailyPrep();
  const html = buildDailyPrepEmail(summary);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "ReserveSit <noreply@reservesit.com>",
      to: adminEmail,
      subject: `📋 Daily Prep: ${summary.restaurantName} — ${summary.date}`,
      html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return NextResponse.json({
      error: "Failed to send daily prep email",
      details: detail || response.statusText,
    }, { status: 502 });
  }

  return NextResponse.json({
    success: true,
    sentTo: adminEmail,
    summary: {
      totalReservations: summary.totalReservations,
      totalCovers: summary.totalCovers,
      vipGuests: summary.vipGuests.length,
      largeParties: summary.largeParties.length,
      highRiskNoShows: summary.highRiskNoShows.length,
    },
  });
}
