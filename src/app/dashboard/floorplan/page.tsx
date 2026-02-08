"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

interface TableItem {
  id: number;
  name: string;
  section: string | null;
  minCapacity: number;
  maxCapacity: number;
  posX: number | null;
  posY: number | null;
  shape: string | null;
  width: number | null;
  height: number | null;
  rotation: number | null;
  isActive: boolean;
  sortOrder: number;
}

interface Reservation {
  id: number;
  guestName: string;
  partySize: number;
  time: string;
  date: string;
  status: string;
  code: string;
}

interface StatusEntry {
  table: TableItem;
  reservation: Reservation | null;
  timeStatus: "empty" | "upcoming" | "arrived" | "seated" | "almost_done";
}

function normalizeTable(t: TableItem): TableItem {
  return {
    ...t,
    posX: t.posX ?? 0,
    posY: t.posY ?? 0,
    shape: t.shape ?? "round",
    width: t.width ?? 8,
    height: t.height ?? 8,
    rotation: t.rotation ?? 0,
  };
}

const STATUS_STYLES: Record<string, string> = {
  empty: "bg-white border-gray-200 text-gray-700",
  upcoming: "bg-blue-50 border-blue-400 text-blue-800",
  arrived: "bg-yellow-50 border-yellow-400 text-yellow-800",
  seated: "bg-green-50 border-green-500 text-green-800",
  almost_done: "bg-orange-50 border-orange-400 text-orange-800",
};

export default function FloorPlanPage() {
  const [mode, setMode] = useState<"live" | "edit">("live");
  const [tables, setTables] = useState<TableItem[]>([]);
  const [statusData, setStatusData] = useState<StatusEntry[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailsId, setDetailsId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [licenseOk, setLicenseOk] = useState<boolean | null>(null);
  const [restaurantName, setRestaurantName] = useState("ReserveKit");

  const containerRef = useRef<HTMLDivElement>(null);
  const tablesRef = useRef<TableItem[]>([]);
  const dragRef = useRef<{ id: number; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => { tablesRef.current = tables; }, [tables]);

  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.json())
      .then(s => {
        const key = String(s.license_floorplan || "").toUpperCase();
        setLicenseOk(/^RK-FLR-[A-Z0-9]{8}$/.test(key));
        if (s.restaurantName) setRestaurantName(s.restaurantName);
      })
      .catch(() => setLicenseOk(false));
  }, []);

  async function loadTables() {
    setLoading(true);
    const res = await fetch("/api/tables");
    const data = await res.json();
    setTables((data as TableItem[]).map(normalizeTable));
    setLoading(false);
  }

  async function loadStatus() {
    setLoading(true);
    const res = await fetch("/api/floorplan/status");
    const data = await res.json();
    const entries = data as StatusEntry[];
    setStatusData(entries);
    setTables(entries.map(e => normalizeTable(e.table)));
    setLoading(false);
  }

  useEffect(() => {
    if (licenseOk === false) return;
    if (mode === "edit") loadTables();
    else loadStatus();
  }, [mode, licenseOk]);

  useEffect(() => {
    if (licenseOk === false || mode !== "live") return;
    const i = setInterval(loadStatus, 10000);
    return () => clearInterval(i);
  }, [mode, licenseOk]);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!dragRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const { id, offsetX, offsetY } = dragRef.current;
      const table = tablesRef.current.find(t => t.id === id);
      if (!table) return;
      const width = table.width ?? 8;
      const height = table.height ?? 8;
      const rawX = ((e.clientX - rect.left - offsetX) / rect.width) * 100;
      const rawY = ((e.clientY - rect.top - offsetY) / rect.height) * 100;
      const posX = Math.min(Math.max(rawX, 0), 100 - width);
      const posY = Math.min(Math.max(rawY, 0), 100 - height);
      setTables(prev => prev.map(t => (t.id === id ? { ...t, posX, posY } : t)));
    }
    function onUp() { dragRef.current = null; }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  async function saveLayout() {
    setSaving(true);
    await fetch("/api/tables/positions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tables: tables.map(t => ({ id: t.id, posX: t.posX ?? 0, posY: t.posY ?? 0, rotation: t.rotation ?? 0 })) }),
    });
    setSaving(false);
  }

  async function updateTable(id: number, patch: Partial<TableItem>) {
    setTables(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)));
    await fetch(`/api/tables/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function addTable() {
    setSaving(true);
    const name = `T${tables.length + 1}`;
    const res = await fetch("/api/tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, minCapacity: 2, maxCapacity: 4, section: "", sortOrder: tables.length + 1 }),
    });
    const created = await res.json();
    const width = 8;
    const height = 8;
    await fetch(`/api/tables/${created.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ posX: (100 - width) / 2, posY: (100 - height) / 2, width, height, shape: "round", rotation: 0 }),
    });
    await loadTables();
    setSaving(false);
  }

  async function removeTable(id: number) {
    if (!confirm("Delete this table?")) return;
    await fetch(`/api/tables/${id}`, { method: "DELETE" });
    setSelectedId(null);
    loadTables();
  }

  async function doAction(resId: number, action: string, tableId?: number) {
    await fetch(`/api/reservations/${resId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...(tableId ? { tableId } : {}) }),
    });
    loadStatus();
    setDetailsId(null);
  }

  const selected = tables.find(t => t.id === selectedId) || null;
  const liveMap = useMemo(() => new Map(statusData.map(s => [s.table.id, s])), [statusData]);

  if (licenseOk === null) {
    return (
      <div className="p-4 sm:p-6">
        <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (licenseOk === false) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold mb-4">Floor Plan</h1>
        <div className="bg-white rounded-xl shadow p-6">
          <p className="text-gray-600 mb-4">Visual Floor Plan is a paid add-on.</p>
          <Link href="/#pricing" className="inline-flex items-center justify-center h-11 px-4 rounded bg-blue-600 text-white text-sm transition-all duration-200">Purchase Add-On</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Floor Plan</h1>
          <p className="text-sm text-gray-500">{restaurantName} live seating view</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode(mode === "live" ? "edit" : "live")}
            className="h-11 px-4 rounded-lg border text-sm font-medium bg-white hover:bg-gray-50 transition-all duration-200"
          >
            {mode === "live" ? "Switch to Edit" : "Switch to Live"}
          </button>
          {mode === "edit" && (
            <>
              <button onClick={addTable} className="h-11 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium transition-all duration-200">Add Table</button>
              <button onClick={saveLayout} className="h-11 px-4 rounded-lg bg-gray-900 text-white text-sm font-medium transition-all duration-200">{saving ? "Saving..." : "Save Layout"}</button>
            </>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_280px] gap-6">
        <div className="bg-white rounded-xl shadow p-4 sm:p-6">
          <div
            ref={containerRef}
            onClick={() => setSelectedId(null)}
            className="relative w-full aspect-[3/2] border-2 border-dashed border-gray-200 rounded-xl bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.06)_1px,transparent_0)] [background-size:18px_18px] overflow-hidden touch-none"
          >
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
              </div>
            )}
            {tables.map(t => {
              const status = mode === "live" ? (liveMap.get(t.id)?.timeStatus || "empty") : "empty";
              const res = mode === "live" ? liveMap.get(t.id)?.reservation || null : null;
              const shapeClass = t.shape === "rect" ? "rounded-lg" : "rounded-full";
              const statusClass = mode === "edit" ? "bg-white border-gray-200 text-gray-700" : STATUS_STYLES[status];
              return (
                <button
                  key={t.id}
                  type="button"
                  onPointerDown={e => {
                    if (mode !== "edit") return;
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedId(t.id);
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    const posX = (t.posX ?? 0) / 100 * rect.width;
                    const posY = (t.posY ?? 0) / 100 * rect.height;
                    dragRef.current = { id: t.id, offsetX: e.clientX - rect.left - posX, offsetY: e.clientY - rect.top - posY };
                  }}
                  onClick={e => {
                    e.stopPropagation();
                    if (mode === "edit") setSelectedId(t.id);
                    else setDetailsId(t.id);
                  }}
                  className={`absolute flex flex-col items-center justify-center text-center border shadow-sm ${shapeClass} ${statusClass} ${selectedId === t.id ? "ring-2 ring-blue-500" : ""} transition-all duration-200`}
                  style={{
                    left: `${t.posX ?? 0}%`,
                    top: `${t.posY ?? 0}%`,
                    width: `${t.width ?? 8}%`,
                    height: `${t.height ?? 8}%`,
                    transform: `rotate(${t.rotation ?? 0}deg)`,
                  }}
                >
                  <span className="text-[10px] sm:text-xs font-semibold leading-tight">{t.name}</span>
                  <span className="text-[10px] text-gray-500">{t.maxCapacity}-top</span>
                  {mode === "live" && res && (
                    <span className="text-[9px] text-gray-500 truncate max-w-full px-1">{res.guestName}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4 sm:p-6">
          <h2 className="text-lg font-bold mb-3">{mode === "edit" ? "Edit Table" : "Legend"}</h2>

          {mode === "edit" ? (
            !selected ? (
              <p className="text-sm text-gray-500">Select a table to edit shape, size, or rotation.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium mb-2">Shape</div>
                  <div className="grid grid-cols-2 gap-2">
                    {(["round", "rect"] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => updateTable(selected.id, { shape: s })}
                        className={`h-11 sm:h-10 rounded border text-sm transition-all duration-200 ${selected.shape === s ? "border-blue-600 text-blue-600" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
                      >
                        {s === "round" ? "Round" : "Rect"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm">Width (%)
                    <input
                      type="number"
                      min={4}
                      max={30}
                      value={selected.width ?? 8}
                      onChange={e => setTables(prev => prev.map(t => t.id === selected.id ? { ...t, width: Number(e.target.value) } : t))}
                      onBlur={e => updateTable(selected.id, { width: Number(e.target.value) })}
                      className="mt-1 w-full border rounded px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="text-sm">Height (%)
                    <input
                      type="number"
                      min={4}
                      max={30}
                      value={selected.height ?? 8}
                      onChange={e => setTables(prev => prev.map(t => t.id === selected.id ? { ...t, height: Number(e.target.value) } : t))}
                      onBlur={e => updateTable(selected.id, { height: Number(e.target.value) })}
                      className="mt-1 w-full border rounded px-3 py-2 text-sm"
                    />
                  </label>
                </div>

                <label className="text-sm">Rotation ({selected.rotation ?? 0}°)
                  <input
                    type="range"
                    min={0}
                    max={360}
                    value={selected.rotation ?? 0}
                    onChange={e => setTables(prev => prev.map(t => t.id === selected.id ? { ...t, rotation: Number(e.target.value) } : t))}
                    className="mt-2 w-full"
                  />
                </label>

                <button onClick={() => removeTable(selected.id)} className="h-11 w-full rounded bg-red-50 text-red-700 border border-red-200 text-sm transition-all duration-200">Delete Table</button>
              </div>
            )
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border border-gray-300 bg-white" />Empty</div>
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border border-blue-400 bg-blue-50" />Reserved (within 1h)</div>
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border border-yellow-400 bg-yellow-50" />Arrived</div>
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border border-green-500 bg-green-50" />Seated</div>
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border border-orange-400 bg-orange-50" />Almost done</div>
              <p className="text-xs text-gray-500 mt-3">Auto-refreshes every 10 seconds.</p>
            </div>
          )}
        </div>
      </div>

      {detailsId && mode === "live" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg p-5 w-full max-w-sm">
            {(() => {
              const entry = liveMap.get(detailsId);
              const res = entry?.reservation || null;
              if (!res) return (
                <div>
                  <div className="text-lg font-bold mb-2">Table Details</div>
                  <p className="text-sm text-gray-600 mb-4">No active reservation.</p>
                  <button onClick={() => setDetailsId(null)} className="h-11 w-full rounded bg-gray-900 text-white text-sm">Close</button>
                </div>
              );
              return (
                <div>
                  <div className="text-lg font-bold mb-1">{res.guestName}</div>
                  <div className="text-sm text-gray-500 mb-4">Party of {res.partySize} · {res.time} · {res.code}</div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {(["approved", "confirmed"].includes(res.status)) && (
                      <button onClick={() => doAction(res.id, "arrive")} className="h-11 sm:h-10 px-4 sm:px-3 rounded bg-yellow-50 text-yellow-800 border border-yellow-200 text-sm transition-all duration-200">Arrive</button>
                    )}
                    {(["arrived", "approved", "confirmed"].includes(res.status)) && (
                      <button onClick={() => doAction(res.id, "seat", detailsId)} className="h-11 sm:h-10 px-4 sm:px-3 rounded bg-green-50 text-green-800 border border-green-200 text-sm transition-all duration-200">Seat</button>
                    )}
                    {res.status === "seated" && (
                      <button onClick={() => doAction(res.id, "complete")} className="h-11 sm:h-10 px-4 sm:px-3 rounded bg-gray-100 text-gray-700 border border-gray-200 text-sm transition-all duration-200">Complete</button>
                    )}
                    {(["approved", "confirmed"].includes(res.status)) && (
                      <button onClick={() => doAction(res.id, "noshow")} className="h-11 sm:h-10 px-4 sm:px-3 rounded bg-red-50 text-red-700 border border-red-200 text-sm transition-all duration-200">No-show</button>
                    )}
                  </div>
                  <button onClick={() => setDetailsId(null)} className="h-11 w-full rounded bg-gray-900 text-white text-sm">Close</button>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
