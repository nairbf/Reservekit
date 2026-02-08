"use client";
import { useState, useEffect, useCallback } from "react";

interface Reservation {
  id: number;
  code: string;
  guestName: string;
  guestPhone: string;
  guestEmail: string | null;
  partySize: number;
  date: string;
  time: string;
  specialRequests: string | null;
  status: string;
  source: string;
  table: { id: number; name: string } | null;
  guest: {
    id: number;
    totalVisits: number;
    vipStatus: string | null;
    allergyNotes: string | null;
  } | null;
}
interface TableItem { id: number; name: string; maxCapacity: number }

const STATUS_PILL: Record<string, string> = {
  pending: "bg-blue-50 text-blue-700",
  counter_offered: "bg-amber-50 text-amber-700",
};

function nth(value: number): string {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
}

function fmt12(value: string): string {
  const match = (value || "").trim().match(/^(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?$/);
  if (!match) return value;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute < 0 || minute > 59) return value;
  if (meridiem) {
    if (hour < 1 || hour > 12) return value;
    if (meridiem === "PM" && hour !== 12) hour += 12;
    if (meridiem === "AM" && hour === 12) hour = 0;
  }
  if (hour < 0 || hour > 23) return value;
  const h = hour % 12 || 12;
  return `${h}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

function normalizeTimeInput(input: string): string | null {
  const value = (input || "").trim();
  const hhmm = value.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (hhmm) return `${String(Number(hhmm[1])).padStart(2, "0")}:${hhmm[2]}`;
  const ampm = value.match(/^(\d{1,2}):([0-5]\d)\s*([AaPp][Mm])$/);
  if (!ampm) return null;
  let hour = Number(ampm[1]);
  const minute = ampm[2];
  const meridiem = ampm[3].toUpperCase();
  if (hour < 1 || hour > 12) return null;
  if (meridiem === "PM" && hour !== 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${minute}`;
}

function fmtDate(value: string): string {
  if (!value) return "Date not set";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function cleanSpecialRequests(value: string | null): string | null {
  return cleanText(value);
}

function displayPhone(value: string): string {
  const normalized = cleanText(value);
  if (!normalized) return "No phone provided";
  return normalized;
}

function cleanText(value: string | null | undefined): string | null {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  if (["0", "n/a", "na", "none", "null", "undefined"].includes(normalized.toLowerCase())) return null;
  return normalized;
}

export default function InboxPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<TableItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    const [r, t] = await Promise.all([
      fetch("/api/reservations?status=pending,counter_offered"),
      fetch("/api/tables"),
    ]);
    setReservations(await r.json());
    setTables(await t.json());
    setRefreshing(false);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
    const i = setInterval(load, 15000);
    return () => clearInterval(i);
  }, [load]);

  async function doAction(id: number, action: string, extra?: Record<string, unknown>) {
    await fetch(`/api/reservations/${id}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    load();
  }

  if (!loaded) {
    return (
      <div className="flex items-center gap-3 text-gray-500">
        <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
        Loading inbox...
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Inbox</h1>
          <p className="text-sm text-gray-500">{reservations.length} pending request{reservations.length === 1 ? "" : "s"}</p>
        </div>
        {refreshing && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
            Refreshing
          </div>
        )}
      </div>

      {reservations.length === 0 && (
        <div className="bg-white rounded-xl shadow p-8 text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xl">✓</div>
          <p className="text-gray-600">No pending requests. All caught up!</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {reservations.map(r => {
          const cleanedRequest = cleanSpecialRequests(r.specialRequests);
          const partySize = r.partySize > 0 ? r.partySize : null;
          const cleanedSource = cleanText(r.source) || "unknown";
          const cleanedCode = cleanText(r.code);
          const cleanedEmail = cleanText(r.guestEmail);
          return (
            <div key={r.id} className="bg-white rounded-xl shadow p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="text-lg font-bold leading-tight">{r.guestName || "Guest"}</div>
                  <div className="text-sm text-gray-500">{partySize ? `Party of ${partySize}` : "Party size not set"}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(r.guest?.totalVisits ?? 0) > 1 && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">↩ {nth(r.guest?.totalVisits ?? 0)} visit</span>
                    )}
                    {r.guest?.vipStatus === "vip" && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">★ VIP</span>
                    )}
                    {r.guest?.allergyNotes && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700">⚠ Allergies</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_PILL[r.status] || "bg-gray-100 text-gray-600"}`}>{r.status.replace(/_/g, " ")}</span>
                  <div className="text-xs text-gray-400 mt-1">Ref: {cleanedCode || "N/A"}</div>
                </div>
              </div>

              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 mb-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-gray-400">When</div>
                    <div className="font-medium text-gray-800">{fmtDate(r.date)} at {fmt12(r.time)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-gray-400">Phone</div>
                    <div className="font-medium text-gray-800">{displayPhone(r.guestPhone)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-gray-400">Source</div>
                    <div className="font-medium text-gray-700 capitalize">{cleanedSource.replace(/_/g, " ")}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-gray-400">Party</div>
                    <div className="font-medium text-gray-700">{partySize ? `${partySize} guests` : "Unspecified"}</div>
                  </div>
                  {cleanedEmail && (
                    <div className="sm:col-span-2">
                      <div className="text-[11px] uppercase tracking-wide text-gray-400">Email</div>
                      <div className="font-medium text-gray-800 break-all">{cleanedEmail}</div>
                    </div>
                  )}
                </div>
              </div>

              {cleanedRequest && <div className="text-sm text-gray-700 mb-3">“{cleanedRequest}”</div>}
              {r.status === "counter_offered" && <div className="text-sm text-amber-700 mb-3">Counter-offer sent and waiting for guest response.</div>}

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <select id={`table-${r.id}`} className="h-11 border rounded px-3 text-sm" defaultValue="">
                  <option value="">No table</option>
                  {tables.filter(t => !partySize || t.maxCapacity >= partySize).map(t => (
                    <option key={t.id} value={t.id}>{t.name} {t.maxCapacity > 0 ? `(${t.maxCapacity}-top)` : ""}</option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    const sel = document.getElementById(`table-${r.id}`) as HTMLSelectElement;
                    doAction(r.id, "approve", sel.value ? { tableId: parseInt(sel.value, 10) } : {});
                  }}
                  className="h-11 w-full rounded bg-green-600 text-white text-sm font-medium transition-all duration-200"
                >
                  Approve
                </button>
                <button onClick={() => doAction(r.id, "decline")} className="h-11 w-full rounded bg-red-600 text-white text-sm font-medium transition-all duration-200">Decline</button>
                <button
                  onClick={() => {
                    const t = prompt("Propose new time (h:mm AM/PM or HH:MM):", fmt12(r.time));
                    if (!t) return;
                    const normalized = normalizeTimeInput(t);
                    if (!normalized) {
                      alert("Enter a valid time like 7:30 PM or 19:30.");
                      return;
                    }
                    doAction(r.id, "counter", { newTime: normalized });
                  }}
                  className="h-11 w-full rounded bg-amber-500 text-white text-sm font-medium transition-all duration-200"
                >
                  Counter
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
