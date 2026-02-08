"use client";
import { useState, useEffect } from "react";

interface Override { id: number; date: string; isClosed: boolean; openTime: string | null; closeTime: string | null; maxCovers: number | null; note: string | null }

export default function SchedulePage() {
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [form, setForm] = useState({ date: "", isClosed: false, openTime: "", closeTime: "", maxCovers: "", note: "" });

  useEffect(() => { load(); }, []);
  async function load() { setOverrides(await (await fetch("/api/day-overrides")).json()); }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/day-overrides", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: form.date, isClosed: form.isClosed, openTime: form.openTime || null, closeTime: form.closeTime || null, maxCovers: form.maxCovers ? parseInt(form.maxCovers) : null, note: form.note || null }) });
    setForm({ date: "", isClosed: false, openTime: "", closeTime: "", maxCovers: "", note: "" }); load();
  }
  async function remove(id: number) { await fetch(`/api/day-overrides/${id}`, { method: "DELETE" }); load(); }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Schedule Overrides</h1>
      <p className="text-gray-600 mb-6">Close dates, change hours for holidays, or adjust capacity for events.</p>
      <form onSubmit={save} className="bg-white rounded shadow p-4 mb-6">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div><label className="block text-sm font-medium mb-1">Date</label><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full border rounded px-3 py-1.5" required /></div>
          <div className="flex items-end pb-1"><label className="flex items-center gap-2"><input type="checkbox" checked={form.isClosed} onChange={e => setForm({ ...form, isClosed: e.target.checked })} /><span className="text-sm font-medium">Closed this day</span></label></div>
        </div>
        {!form.isClosed && (
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div><label className="block text-sm font-medium mb-1">Open</label><input type="time" value={form.openTime} onChange={e => setForm({ ...form, openTime: e.target.value })} className="w-full border rounded px-3 py-1.5" /></div>
            <div><label className="block text-sm font-medium mb-1">Close</label><input type="time" value={form.closeTime} onChange={e => setForm({ ...form, closeTime: e.target.value })} className="w-full border rounded px-3 py-1.5" /></div>
            <div><label className="block text-sm font-medium mb-1">Max Covers</label><input type="number" value={form.maxCovers} onChange={e => setForm({ ...form, maxCovers: e.target.value })} className="w-full border rounded px-3 py-1.5" placeholder="Default" /></div>
          </div>
        )}
        <div className="mb-3"><label className="block text-sm font-medium mb-1">Note</label><input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} className="w-full border rounded px-3 py-1.5" placeholder="e.g., Private event, Holiday hours" /></div>
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm">Save Override</button>
      </form>
      <div className="bg-white rounded shadow">
        {overrides.length === 0 && <p className="p-4 text-gray-500">No overrides. Default hours apply every day.</p>}
        {overrides.map(o => (
          <div key={o.id} className="flex items-center justify-between px-4 py-3 border-b last:border-0">
            <div>
              <span className="font-medium">{o.date}</span>
              {o.isClosed ? <span className="ml-2 text-red-600 text-sm font-medium">CLOSED</span> : <span className="ml-2 text-gray-500 text-sm">{o.openTime && o.closeTime ? `${o.openTime}–${o.closeTime}` : "Modified"}{o.maxCovers ? ` · Max ${o.maxCovers}` : ""}</span>}
              {o.note && <span className="ml-2 text-gray-400 text-sm">— {o.note}</span>}
            </div>
            <button onClick={() => remove(o.id)} className="text-red-500 text-sm">Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}
