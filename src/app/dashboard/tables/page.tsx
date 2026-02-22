"use client";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { useHasPermission } from "@/hooks/use-permissions";

interface TableItem { id: number; name: string; section: string | null; minCapacity: number; maxCapacity: number }

export default function TablesPage() {
  const canManageTables = useHasPermission("manage_tables");
  const searchParams = useSearchParams();
  const [tables, setTables] = useState<TableItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", section: "", minCapacity: 1, maxCapacity: 4 });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const showTourHighlight = searchParams.get("fromSetup") === "1" && searchParams.get("tour") === "tables";

  if (!canManageTables) return <AccessDenied />;

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tables");
      if (!res.ok) {
        setError("Failed to load tables. Please try again.");
        return;
      }
      const data = await res.json();
      setTables(Array.isArray(data) ? data : []);
      setError("");
    } catch {
      setError("Failed to load tables. Please try again.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addTable(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/tables", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (!res.ok) {
      alert("Failed to save table. Please try again.");
      return;
    }
    setForm({ name: "", section: "", minCapacity: 1, maxCapacity: 4 });
    setShowForm(false);
    load();
  }

  async function deleteTable(id: number) {
    if (!confirm("Delete this table?")) return;
    const res = await fetch(`/api/tables/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Failed to delete table. Please try again.");
      return;
    }
    load();
  }

  return (
    <div className={showTourHighlight ? "rounded-2xl ring-2 ring-blue-300 p-2" : ""}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Tables</h1>
          <p className="text-sm text-gray-500">Manage dining room capacity</p>
        </div>
        <button onClick={() => setShowForm(true)} className="h-11 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium transition-all duration-200">+ Add Table</button>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!loaded ? (
        <div className="flex items-center gap-3 text-gray-500">
          <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
          Loading tables...
        </div>
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {tables.map(t => (
              <div key={t.id} className="bg-white rounded-xl shadow p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold text-lg">{t.name}</div>
                    {t.section && <div className="text-sm text-gray-500">{t.section}</div>}
                  </div>
                  <button onClick={() => deleteTable(t.id)} className="h-11 px-3 rounded-lg border border-red-200 text-red-600 text-sm transition-all duration-200">Delete</button>
                </div>
                <div className="text-sm text-gray-600 mt-2">Seats {t.minCapacity}–{t.maxCapacity}</div>
                <div className="text-xs text-gray-400 mt-1">ID: {t.id}</div>
              </div>
            ))}
            {tables.length === 0 && <div className="bg-white rounded-xl shadow p-6 text-center text-gray-500">No tables yet. Add your first table.</div>}
          </div>

          <div className="hidden md:block bg-white rounded-xl shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-4 font-medium">Name</th>
                  <th className="text-left p-4 font-medium">Section</th>
                  <th className="text-left p-4 font-medium">Capacity</th>
                  <th className="text-right p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tables.map(t => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="p-4 font-medium">{t.name}</td>
                    <td className="p-4 text-gray-500">{t.section || "—"}</td>
                    <td className="p-4 text-gray-600">{t.minCapacity}–{t.maxCapacity}</td>
                    <td className="p-4 text-right">
                      <button onClick={() => deleteTable(t.id)} className="text-red-600 text-sm">Delete</button>
                    </td>
                  </tr>
                ))}
                {tables.length === 0 && (
                  <tr><td colSpan={4} className="p-6 text-center text-gray-500">No tables yet. Add your first table.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 p-0 sm:flex sm:items-center sm:justify-center sm:p-4">
          <form onSubmit={addTable} className="h-full w-full overflow-y-auto bg-white p-4 sm:h-auto sm:max-w-md sm:rounded-xl sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Add Table</h2>
              <button type="button" onClick={() => setShowForm(false)} className="h-11 w-11 rounded-lg border border-gray-200">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input className="h-11 w-full border rounded px-3 text-sm" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Section</label>
                <input className="h-11 w-full border rounded px-3 text-sm" value={form.section} onChange={e => setForm({ ...form, section: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Min</label>
                  <input type="number" className="h-11 w-full border rounded px-3 text-sm" value={form.minCapacity} onChange={e => setForm({ ...form, minCapacity: parseInt(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Max</label>
                  <input type="number" className="h-11 w-full border rounded px-3 text-sm" value={form.maxCapacity} onChange={e => setForm({ ...form, maxCapacity: parseInt(e.target.value) })} />
                </div>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="h-11 flex-1 rounded-lg border border-gray-200 text-gray-700 transition-all duration-200">Cancel</button>
              <button type="submit" className="h-11 flex-1 rounded-lg bg-blue-600 text-white font-medium transition-all duration-200">Save Table</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
