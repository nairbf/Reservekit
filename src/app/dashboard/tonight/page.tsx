"use client";
import { useState, useEffect, useCallback } from "react";

interface Reservation { id: number; code: string; guestName: string; partySize: number; date: string; time: string; status: string; source: string; table: { id: number; name: string } | null }
interface TableItem { id: number; name: string; maxCapacity: number }
const SC: Record<string, string> = { approved: "bg-blue-100 text-blue-800", confirmed: "bg-blue-200 text-blue-900", arrived: "bg-yellow-100 text-yellow-800", seated: "bg-green-100 text-green-800", completed: "bg-gray-100 text-gray-500", no_show: "bg-red-100 text-red-700" };

export default function TonightPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<TableItem[]>([]);
  const today = new Date().toISOString().split("T")[0];
  const load = useCallback(async () => {
    const [r, t] = await Promise.all([fetch(`/api/reservations?status=all&date=${today}`), fetch("/api/tables")]);
    setReservations(await r.json()); setTables(await t.json());
  }, [today]);
  useEffect(() => { load(); const i = setInterval(load, 10000); return () => clearInterval(i); }, [load]);

  async function doAction(id: number, action: string, extra?: Record<string, unknown>) {
    await fetch(`/api/reservations/${id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) }); load();
  }
  async function addWalkin() {
    const name = prompt("Guest name:"); if (!name) return;
    const size = prompt("Party size:", "2"); if (!size) return;
    const tid = prompt("Table ID (or leave blank):");
    await fetch("/api/reservations/staff-create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ guestName: name, partySize: parseInt(size), source: "walkin", tableId: tid ? parseInt(tid) : null }) }); load();
  }

  const byTime: Record<string, Reservation[]> = {};
  for (const r of reservations) { if (["cancelled", "declined", "expired"].includes(r.status)) continue; if (!byTime[r.time]) byTime[r.time] = []; byTime[r.time].push(r); }
  const sortedTimes = Object.keys(byTime).sort();
  const tableStatus: Record<number, Reservation | null> = {};
  for (const t of tables) tableStatus[t.id] = null;
  for (const r of reservations) { if (r.table && ["seated", "arrived"].includes(r.status)) tableStatus[r.table.id] = r; }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Tonight — {today}</h1>
        <button onClick={addWalkin} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">+ Walk-in</button>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-6">
        {tables.map(t => { const occ = tableStatus[t.id]; return (
          <div key={t.id} className={`rounded p-2 text-center text-xs border ${occ?.status === "seated" ? "bg-green-200 border-green-400" : occ?.status === "arrived" ? "bg-yellow-200 border-yellow-400" : "bg-white border-gray-200"}`}>
            <div className="font-bold">{t.name}</div><div className="text-gray-500">{t.maxCapacity}-top</div>
            {occ && <div className="mt-1 truncate">{occ.guestName}</div>}
          </div>); })}
      </div>
      <div className="space-y-4">
        {sortedTimes.map(time => (
          <div key={time}><h2 className="font-bold text-lg mb-2">{time}</h2>
            <div className="space-y-2">{byTime[time].map(r => (
              <div key={r.id} className="bg-white rounded shadow px-4 py-3 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${SC[r.status] || "bg-gray-100"}`}>{r.status}</span>
                  <span className="font-medium">{r.guestName}</span><span className="text-gray-500 text-sm">({r.partySize})</span>
                  {r.table && <span className="text-sm text-gray-400">{r.table.name}</span>}
                </div>
                <div className="flex gap-1">
                  {["approved", "confirmed"].includes(r.status) && <button onClick={() => doAction(r.id, "arrive")} className="text-xs bg-yellow-100 px-2 py-1 rounded">Arrived</button>}
                  {["arrived", "approved", "confirmed"].includes(r.status) && <button onClick={() => { const tid = prompt("Table ID:"); doAction(r.id, "seat", tid ? { tableId: parseInt(tid) } : {}); }} className="text-xs bg-green-100 px-2 py-1 rounded">Seat</button>}
                  {r.status === "seated" && <button onClick={() => doAction(r.id, "complete")} className="text-xs bg-gray-200 px-2 py-1 rounded">Complete</button>}
                  {["approved", "confirmed"].includes(r.status) && <button onClick={() => doAction(r.id, "noshow")} className="text-xs bg-red-100 px-2 py-1 rounded">No-show</button>}
                </div>
              </div>))}</div>
          </div>))}
      </div>
      {sortedTimes.length === 0 && <div className="bg-white rounded shadow p-8 text-center text-gray-500">No reservations for today yet.</div>}
    </div>
  );
}
