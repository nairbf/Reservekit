"use client";
import { useState, useEffect, useCallback } from "react";

interface Reservation {
  id: number;
  code: string;
  guestName: string;
  guestPhone: string;
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
        {reservations.map(r => (
          <div key={r.id} className="bg-white rounded-xl shadow p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="text-lg font-bold">{r.guestName}</div>
                <div className="text-sm text-gray-500">Party of {r.partySize}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {r.guest?.totalVisits && r.guest.totalVisits > 1 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">↩ {nth(r.guest.totalVisits)} visit</span>
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
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_PILL[r.status] || "bg-gray-100 text-gray-600"}`}>{r.status.replace("_", " ")}</span>
                <div className="text-xs text-gray-400 mt-1">{r.code}</div>
              </div>
            </div>

            <div className="text-sm text-gray-600 mb-2">{r.date} · {r.time} · {r.guestPhone}</div>
            <div className="text-xs text-gray-400 mb-3">Source: {r.source}</div>
            {r.specialRequests && <div className="text-sm text-gray-600 mb-3">“{r.specialRequests}”</div>}
            {r.status === "counter_offered" && <div className="text-sm text-amber-600 mb-3">Counter-offer sent — awaiting guest response.</div>}

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <select id={`table-${r.id}`} className="h-11 border rounded px-3 text-sm" defaultValue="">
                <option value="">No table</option>
                {tables.filter(t => t.maxCapacity >= r.partySize).map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.maxCapacity}-top)</option>
                ))}
              </select>
              <button
                onClick={() => {
                  const sel = document.getElementById(`table-${r.id}`) as HTMLSelectElement;
                  doAction(r.id, "approve", sel.value ? { tableId: parseInt(sel.value) } : {});
                }}
                className="h-11 w-full rounded bg-green-600 text-white text-sm font-medium transition-all duration-200"
              >
                Approve
              </button>
              <button onClick={() => doAction(r.id, "decline")} className="h-11 w-full rounded bg-red-600 text-white text-sm font-medium transition-all duration-200">Decline</button>
              <button
                onClick={() => {
                  const t = prompt("Propose new time (HH:MM):", r.time);
                  if (t) doAction(r.id, "counter", { newTime: t });
                }}
                className="h-11 w-full rounded bg-amber-500 text-white text-sm font-medium transition-all duration-200"
              >
                Counter
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
