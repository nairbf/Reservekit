"use client";
import { useState, useEffect, useCallback } from "react";

interface TableItem { id: number; name: string; section: string | null; minCapacity: number; maxCapacity: number }

export default function TablesPage() {
  const [tables, setTables] = useState<TableItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", section: "", minCapacity: 1, maxCapacity: 4 });
  const load = useCallback(async () => { setTables(await (await fetch("/api/tables")).json()); }, []);
  useEffect(() => { load(); }, [load]);

  async function addTable(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/tables", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setForm({ name: "", section: "", minCapacity: 1, maxCapacity: 4 }); setShowForm(false); load();
  }
  async function deleteTable(id: number) { if (!confirm("Delete this table?")) return; await fetch(`/api/tables/${id}`, { method: "DELETE" }); load(); }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Tables</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white px-4 py-2 rounded">+ Add Table</button>
      </div>
      {showForm && (
        <form onSubmit={addTable} className="bg-white p-4 rounded shadow mb-6 flex gap-3 items-end flex-wrap">
          <div><label className="block text-sm font-medium mb-1">Name</label><input className="border rounded px-2 py-1" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
          <div><label className="block text-sm font-medium mb-1">Section</label><input className="border rounded px-2 py-1" value={form.section} onChange={e => setForm({ ...form, section: e.target.value })} /></div>
          <div><label className="block text-sm font-medium mb-1">Min</label><input type="number" className="border rounded px-2 py-1 w-16" value={form.minCapacity} onChange={e => setForm({ ...form, minCapacity: parseInt(e.target.value) })} /></div>
          <div><label className="block text-sm font-medium mb-1">Max</label><input type="number" className="border rounded px-2 py-1 w-16" value={form.maxCapacity} onChange={e => setForm({ ...form, maxCapacity: parseInt(e.target.value) })} /></div>
          <button type="submit" className="bg-green-600 text-white px-4 py-1 rounded">Save</button>
        </form>
      )}
      <div className="bg-white rounded shadow">
        {tables.map(t => (
          <div key={t.id} className="flex items-center justify-between px-4 py-3 border-b last:border-0">
            <div><span className="font-medium">{t.name}</span>{t.section && <span className="text-gray-500 ml-2">({t.section})</span>}</div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">Seats {t.minCapacity}–{t.maxCapacity}</span>
              <span className="text-xs text-gray-400">ID: {t.id}</span>
              <button onClick={() => deleteTable(t.id)} className="text-red-500 text-sm">Delete</button>
            </div>
          </div>
        ))}
        {tables.length === 0 && <p className="p-4 text-gray-500">No tables yet. Add your first table above.</p>}
      </div>
    </div>
  );
}
