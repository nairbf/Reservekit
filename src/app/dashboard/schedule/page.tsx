"use client";
import { useState, useEffect } from "react";

interface Override { id: number; date: string; isClosed: boolean; openTime: string | null; closeTime: string | null; maxCovers: number | null; note: string | null }

export default function SchedulePage() {
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [form, setForm] = useState({ date: "", isClosed: false, openTime: "", closeTime: "", maxCovers: "", note: "" });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { load(); }, []);
  async function load() { setOverrides(await (await fetch("/api/day-overrides")).json()); setLoaded(true); }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/day-overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: form.date,
        isClosed: form.isClosed,
        openTime: form.openTime || null,
        closeTime: form.closeTime || null,
        maxCovers: form.maxCovers ? parseInt(form.maxCovers) : null,
        note: form.note || null,
      }),
    });
    setForm({ date: "", isClosed: false, openTime: "", closeTime: "", maxCovers: "", note: "" });
    load();
  }

  async function remove(id: number) { await fetch(`/api/day-overrides/${id}`, { method: "DELETE" }); load(); }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Schedule Overrides</h1>
        <p className="text-gray-500">Close dates, change hours for holidays, or adjust capacity for events.</p>
      </div>

      <form onSubmit={save} className="bg-white rounded-xl shadow p-4 sm:p-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="h-11 w-full border rounded px-3" required />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={form.isClosed} onChange={e => setForm({ ...form, isClosed: e.target.checked })} className="h-4 w-4" />
              Closed this day
            </label>
          </div>
        </div>

        {!form.isClosed && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Open</label>
              <input type="time" value={form.openTime} onChange={e => setForm({ ...form, openTime: e.target.value })} className="h-11 w-full border rounded px-3" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Close</label>
              <input type="time" value={form.closeTime} onChange={e => setForm({ ...form, closeTime: e.target.value })} className="h-11 w-full border rounded px-3" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max Covers</label>
              <input type="number" value={form.maxCovers} onChange={e => setForm({ ...form, maxCovers: e.target.value })} className="h-11 w-full border rounded px-3" placeholder="Default" />
            </div>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Note</label>
          <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} className="h-11 w-full border rounded px-3" placeholder="e.g., Private event, Holiday hours" />
        </div>

        <button type="submit" className="h-11 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium transition-all duration-200">Save Override</button>
      </form>

      {!loaded ? (
        <div className="flex items-center gap-3 text-gray-500">
          <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
          Loading overrides...
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow divide-y">
          {overrides.length === 0 && <p className="p-4 text-gray-500">No overrides. Default hours apply every day.</p>}
          {overrides.map(o => (
            <div key={o.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <span className="font-medium">{o.date}</span>
                {o.isClosed ? (
                  <span className="ml-2 text-red-600 text-sm font-medium">CLOSED</span>
                ) : (
                  <span className="ml-2 text-gray-500 text-sm">{o.openTime && o.closeTime ? `${o.openTime}–${o.closeTime}` : "Modified"}{o.maxCovers ? ` · Max ${o.maxCovers}` : ""}</span>
                )}
                {o.note && <span className="ml-2 text-gray-400 text-sm">— {o.note}</span>}
              </div>
              <button onClick={() => remove(o.id)} className="h-11 px-3 rounded-lg border border-red-200 text-red-600 text-sm transition-all duration-200">Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
