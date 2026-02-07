"use client";
import { useState, useEffect, useCallback } from "react";

interface Reservation { id: number; code: string; guestName: string; guestPhone: string; partySize: number; date: string; time: string; specialRequests: string | null; status: string; source: string; table: { id: number; name: string } | null }
interface TableItem { id: number; name: string; maxCapacity: number }

export default function InboxPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<TableItem[]>([]);
  const load = useCallback(async () => {
    const [r, t] = await Promise.all([fetch("/api/reservations?status=pending,counter_offered"), fetch("/api/tables")]);
    setReservations(await r.json()); setTables(await t.json());
  }, []);
  useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i); }, [load]);

  async function doAction(id: number, action: string, extra?: Record<string, unknown>) {
    await fetch(`/api/reservations/${id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Inbox <span className="text-gray-400 font-normal text-lg">({reservations.length} pending)</span></h1>
      {reservations.length === 0 && <div className="bg-white rounded shadow p-8 text-center text-gray-500">No pending requests. All caught up!</div>}
      <div className="space-y-4">
        {reservations.map(r => (
          <div key={r.id} className="bg-white rounded shadow p-4">
            <div className="flex justify-between items-start mb-2">
              <div><span className="font-bold text-lg">{r.guestName}</span><span className="text-gray-500 ml-2">Party of {r.partySize}</span></div>
              <span className="text-sm text-gray-400">{r.code}</span>
            </div>
            <div className="text-sm text-gray-600 mb-1">📅 {r.date} at {r.time} &nbsp;|&nbsp; 📱 {r.guestPhone} &nbsp;|&nbsp; via {r.source}</div>
            {r.specialRequests && <div className="text-sm text-gray-600 mb-2">💬 {r.specialRequests}</div>}
            {r.status === "counter_offered" && <div className="text-sm text-amber-600 mb-2">⏳ Counter-offer sent</div>}
            <div className="flex gap-2 mt-3 flex-wrap">
              <select id={`table-${r.id}`} className="border rounded px-2 py-1 text-sm" defaultValue="">
                <option value="">No table</option>
                {tables.filter(t => t.maxCapacity >= r.partySize).map(t => <option key={t.id} value={t.id}>{t.name} ({t.maxCapacity}-top)</option>)}
              </select>
              <button onClick={() => { const sel = document.getElementById(`table-${r.id}`) as HTMLSelectElement; doAction(r.id, "approve", sel.value ? { tableId: parseInt(sel.value) } : {}); }} className="bg-green-600 text-white px-3 py-1 rounded text-sm">✓ Approve</button>
              <button onClick={() => doAction(r.id, "decline")} className="bg-red-500 text-white px-3 py-1 rounded text-sm">✗ Decline</button>
              <button onClick={() => { const t = prompt("Propose new time (HH:MM):", r.time); if (t) doAction(r.id, "counter", { newTime: t }); }} className="bg-amber-500 text-white px-3 py-1 rounded text-sm">↔ Counter</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
