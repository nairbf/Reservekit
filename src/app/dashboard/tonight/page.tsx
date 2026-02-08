"use client";
import { useState, useEffect, useCallback } from "react";

interface Reservation {
  id: number;
  code: string;
  guestName: string;
  partySize: number;
  date: string;
  time: string;
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
const SC: Record<string, string> = {
  approved: "bg-blue-50 text-blue-700",
  confirmed: "bg-blue-100 text-blue-800",
  arrived: "bg-yellow-50 text-yellow-800",
  seated: "bg-green-50 text-green-800",
  completed: "bg-gray-100 text-gray-600",
  no_show: "bg-red-50 text-red-700",
};

function nth(value: number): string {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
}

export default function TonightPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<TableItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const today = new Date().toISOString().split("T")[0];

  const load = useCallback(async () => {
    const [r, t] = await Promise.all([fetch(`/api/reservations?status=all&date=${today}`), fetch("/api/tables")]);
    setReservations(await r.json());
    setTables(await t.json());
    setLoaded(true);
  }, [today]);

  useEffect(() => { load(); const i = setInterval(load, 10000); return () => clearInterval(i); }, [load]);

  async function doAction(id: number, action: string, extra?: Record<string, unknown>) {
    await fetch(`/api/reservations/${id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
    load();
  }

  async function addWalkin() {
    const name = prompt("Guest name:"); if (!name) return;
    const size = prompt("Party size:", "2"); if (!size) return;
    const tid = prompt("Table ID (or leave blank):");
    await fetch("/api/reservations/staff-create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ guestName: name, partySize: parseInt(size), source: "walkin", tableId: tid ? parseInt(tid) : null }) });
    load();
  }

  if (!loaded) {
    return (
      <div className="flex items-center gap-3 text-gray-500">
        <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
        Loading tonight...
      </div>
    );
  }

  const activeReservations = reservations.filter(r => !["cancelled", "declined", "expired"].includes(r.status));
  const totalCovers = activeReservations.reduce((s, r) => s + r.partySize, 0);
  const seatedCovers = activeReservations.filter(r => ["seated", "completed"].includes(r.status)).reduce((s, r) => s + r.partySize, 0);

  const byTime: Record<string, Reservation[]> = {};
  for (const r of reservations) {
    if (["cancelled", "declined", "expired"].includes(r.status)) continue;
    if (!byTime[r.time]) byTime[r.time] = [];
    byTime[r.time].push(r);
  }
  const sortedTimes = Object.keys(byTime).sort();
  const tableStatus: Record<number, Reservation | null> = {};
  for (const t of tables) tableStatus[t.id] = null;
  for (const r of reservations) { if (r.table && ["seated", "arrived"].includes(r.status)) tableStatus[r.table.id] = r; }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Tonight — {today}</h1>
          <p className="text-sm text-gray-500">{seatedCovers} seated / {totalCovers} total covers</p>
        </div>
        <button onClick={addWalkin} className="h-11 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium transition-all duration-200">+ Walk-in</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        {tables.map(t => {
          const occ = tableStatus[t.id];
          return (
            <div key={t.id} className={`rounded-lg p-2 text-center text-xs border ${occ?.status === "seated" ? "bg-green-100 border-green-300" : occ?.status === "arrived" ? "bg-yellow-100 border-yellow-300" : "bg-white border-gray-200"}`}>
              <div className="font-bold text-sm">{t.name}</div>
              <div className="text-gray-500">{t.maxCapacity}-top</div>
              {occ && <div className="mt-1 truncate text-gray-600">{occ.guestName}</div>}
            </div>
          );
        })}
      </div>

      <div className="space-y-4">
        {sortedTimes.map(time => (
          <div key={time}>
            <h2 className="font-bold text-lg mb-2">{time}</h2>
            <div className="space-y-2">
              {byTime[time].map(r => (
                <div key={r.id} className="bg-white rounded-xl shadow px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SC[r.status] || "bg-gray-100 text-gray-600"}`}>{r.status.replace("_", " ")}</span>
                    <span className="font-medium">{r.guestName}</span>
                    <span className="text-sm text-gray-500">({r.partySize})</span>
                    {r.table && <span className="text-sm text-gray-400">{r.table.name}</span>}
                    {r.guest?.totalVisits && r.guest.totalVisits > 1 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">↩ {nth(r.guest.totalVisits)} visit</span>}
                    {r.guest?.vipStatus === "vip" && <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">★ VIP</span>}
                    {r.guest?.allergyNotes && <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700">⚠ Allergies</span>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(["approved", "confirmed"].includes(r.status)) && (
                      <button onClick={() => doAction(r.id, "arrive")} className="h-11 sm:h-9 px-4 sm:px-3 rounded bg-yellow-50 text-yellow-800 border border-yellow-200 text-xs transition-all duration-200">Arrived</button>
                    )}
                    {(["arrived", "approved", "confirmed"].includes(r.status)) && (
                      <button onClick={() => { const tid = prompt("Table ID:"); doAction(r.id, "seat", tid ? { tableId: parseInt(tid) } : {}); }} className="h-11 sm:h-9 px-4 sm:px-3 rounded bg-green-50 text-green-800 border border-green-200 text-xs transition-all duration-200">Seat</button>
                    )}
                    {r.status === "seated" && (
                      <button onClick={() => doAction(r.id, "complete")} className="h-11 sm:h-9 px-4 sm:px-3 rounded bg-gray-100 text-gray-700 border border-gray-200 text-xs transition-all duration-200">Complete</button>
                    )}
                    {(["approved", "confirmed"].includes(r.status)) && (
                      <button onClick={() => doAction(r.id, "noshow")} className="h-11 sm:h-9 px-4 sm:px-3 rounded bg-red-50 text-red-700 border border-red-200 text-xs transition-all duration-200">No-show</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {sortedTimes.length === 0 && (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">No reservations for today yet.</div>
      )}
    </div>
  );
}
