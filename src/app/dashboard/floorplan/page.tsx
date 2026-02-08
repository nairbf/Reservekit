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

interface PosStatusEntry {
  tableId: number;
  orderId: string;
  checkTotal: string;
  balanceDue: string;
  serverName: string;
  openedAt: string;
  closedAt: string | null;
  isOpen: boolean;
  syncedAt: string;
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

function formatMoney(value: string): string {
  const num = Number(value);
  if (Number.isFinite(num)) return `$${num.toFixed(2)}`;
  if (!value) return "$0.00";
  return value.startsWith("$") ? value : `$${value}`;
}

function minutesSince(timestamp: string): number | null {
  if (!timestamp) return null;
  const dt = new Date(timestamp);
  if (Number.isNaN(dt.getTime())) return null;
  return Math.max(0, Math.round((Date.now() - dt.getTime()) / 60000));
}

function formatTime12(value: string): string {
  const match = (value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return value;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return value;
  const h = hour % 12 || 12;
  return `${h}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

export default function FloorPlanPage() {
  const [mode, setMode] = useState<"live" | "edit">("live");
  const [tables, setTables] = useState<TableItem[]>([]);
  const [statusData, setStatusData] = useState<StatusEntry[]>([]);
  const [posStatusMap, setPosStatusMap] = useState<Record<number, PosStatusEntry>>({});
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailsId, setDetailsId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [licenseOk, setLicenseOk] = useState<boolean | null>(null);
  const [restaurantName, setRestaurantName] = useState("ReserveKit");
  const [draggingId, setDraggingId] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const tablesRef = useRef<TableItem[]>([]);
  const dragRef = useRef<{ id: number; offsetX: number; offsetY: number; startX: number; startY: number } | null>(null);
  const pendingPosRef = useRef<{ id: number; posX: number; posY: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const initialLoadedRef = useRef(false);

  useEffect(() => { tablesRef.current = tables; }, [tables]);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then(r => r.json()),
      fetch("/api/auth/me").then(r => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([s, session]) => {
        const key = String(s.license_floorplan || "").toUpperCase();
        const hasKey = /^RK-FLR-[A-Z0-9]{8}$/.test(key);
        const isAdmin = session?.role === "admin";
        setLicenseOk(hasKey || isAdmin);
        if (s.restaurantName) setRestaurantName(s.restaurantName);
      })
      .catch(() => setLicenseOk(false));
  }, []);

  function applyPendingPosition() {
    const next = pendingPosRef.current;
    if (!next) return;
    setTables(prev => prev.map(t => (t.id === next.id ? { ...t, posX: next.posX, posY: next.posY } : t)));
    pendingPosRef.current = null;
  }

  function queueDragPosition(next: { id: number; posX: number; posY: number }) {
    pendingPosRef.current = next;
    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      applyPendingPosition();
      rafRef.current = null;
    });
  }

  async function loadTables(silent = false) {
    if (!initialLoadedRef.current || !silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch("/api/tables");
      const data = await res.json();
      setTables((data as TableItem[]).map(normalizeTable));
      initialLoadedRef.current = true;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadStatus(silent = false) {
    if (!initialLoadedRef.current || !silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [statusRes, posRes] = await Promise.all([
        fetch("/api/floorplan/status"),
        fetch("/api/spoton/sync").catch(() => null),
      ]);
      const data = await statusRes.json();
      const entries = data as StatusEntry[];
      setStatusData(entries);
      setTables(entries.map(e => normalizeTable(e.table)));

      if (posRes && posRes.ok) {
        const posData = await posRes.json();
        const nextPosMap: Record<number, PosStatusEntry> = {};
        const list = Array.isArray(posData.status) ? posData.status as PosStatusEntry[] : [];
        for (const item of list) {
          if (!item || !item.tableId) continue;
          nextPosMap[item.tableId] = item;
        }
        setPosStatusMap(nextPosMap);
      } else {
        setPosStatusMap({});
      }

      initialLoadedRef.current = true;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (licenseOk === false) return;
    setSelectedId(null);
    setDetailsId(null);
    if (mode === "edit") loadTables(false);
    else loadStatus(false);
  }, [mode, licenseOk]);

  useEffect(() => {
    if (licenseOk === false || mode !== "live") return;
    const i = setInterval(() => loadStatus(true), 10000);
    return () => clearInterval(i);
  }, [mode, licenseOk]);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!dragRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const { id, offsetX, offsetY, startX, startY } = dragRef.current;
      const table = tablesRef.current.find(t => t.id === id);
      if (!table) return;
      const moved = Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY) > 3;
      if (moved) suppressClickRef.current = true;
      const width = table.width ?? 8;
      const height = table.height ?? 8;
      const rawX = ((e.clientX - rect.left - offsetX) / rect.width) * 100;
      const rawY = ((e.clientY - rect.top - offsetY) / rect.height) * 100;
      const posX = Math.min(Math.max(rawX, 0), 100 - width);
      const posY = Math.min(Math.max(rawY, 0), 100 - height);
      queueDragPosition({ id, posX, posY });
    }
    function onUp() {
      applyPendingPosition();
      dragRef.current = null;
      setDraggingId(null);
      window.setTimeout(() => { suppressClickRef.current = false; }, 0);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
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
    try {
      const nextSort = tables.length + 1;
      const name = `T${nextSort}`;
      const createRes = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, minCapacity: 2, maxCapacity: 4, section: "", sortOrder: nextSort }),
      });
      if (!createRes.ok) throw new Error("Failed to create table");

      const created = (await createRes.json()) as Partial<TableItem> & { id: number; name: string };
      const width = 8;
      const height = 8;
      const patch = { posX: (100 - width) / 2, posY: (100 - height) / 2, width, height, shape: "round", rotation: 0 };

      const updateRes = await fetch(`/api/tables/${created.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!updateRes.ok) throw new Error("Failed to initialize table position");

      const localTable = normalizeTable({
        id: created.id,
        name: created.name,
        section: created.section ?? null,
        minCapacity: created.minCapacity ?? 1,
        maxCapacity: created.maxCapacity ?? 4,
        isActive: created.isActive ?? true,
        sortOrder: created.sortOrder ?? nextSort,
        ...patch,
      });

      setTables(prev => [...prev, localTable]);
      setSelectedId(localTable.id);
    } catch (err) {
      console.error("[FLOORPLAN ADD TABLE]", err);
      await loadTables(true);
    } finally {
      setSaving(false);
    }
  }

  async function removeTable(id: number) {
    if (!confirm("Delete this table?")) return;
    await fetch(`/api/tables/${id}`, { method: "DELETE" });
    setSelectedId(null);
    loadTables(true);
  }

  async function doAction(resId: number, action: string, tableId?: number) {
    await fetch(`/api/reservations/${resId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...(tableId ? { tableId } : {}) }),
    });
    loadStatus(true);
    setDetailsId(null);
  }

  async function createWalkinFromPos(tableId: number) {
    const table = tables.find(t => t.id === tableId);
    const partySize = Math.max(1, Math.min(table?.maxCapacity || 2, 8));
    await fetch("/api/reservations/staff-create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guestName: `Walk-in ${table?.name || `Table ${tableId}`}`,
        partySize,
        source: "walkin",
        tableId,
      }),
    });
    setDetailsId(null);
    loadStatus(true);
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
          {refreshing && <span className="text-xs text-gray-500">Refreshing...</span>}
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
            {loading && !initialLoadedRef.current && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
              </div>
            )}
            {tables.map(t => {
              const status = mode === "live" ? (liveMap.get(t.id)?.timeStatus || "empty") : "empty";
              const res = mode === "live" ? liveMap.get(t.id)?.reservation || null : null;
              const pos = mode === "live" ? posStatusMap[t.id] : undefined;
              const openMinutes = pos ? minutesSince(pos.openedAt) : null;
              const longCheck = openMinutes !== null && openMinutes > 90;
              const untracked = Boolean(pos && !res);
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
                    (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
                    setSelectedId(t.id);
                    setDraggingId(t.id);
                    suppressClickRef.current = false;
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    const posX = (t.posX ?? 0) / 100 * rect.width;
                    const posY = (t.posY ?? 0) / 100 * rect.height;
                    dragRef.current = { id: t.id, offsetX: e.clientX - rect.left - posX, offsetY: e.clientY - rect.top - posY, startX: e.clientX, startY: e.clientY };
                  }}
                  onClick={e => {
                    e.stopPropagation();
                    if (suppressClickRef.current) {
                      e.preventDefault();
                      return;
                    }
                    if (mode === "edit") setSelectedId(t.id);
                    else setDetailsId(t.id);
                  }}
                  className={`absolute flex flex-col items-center justify-center text-center border shadow-sm ${shapeClass} ${statusClass} ${selectedId === t.id ? "ring-2 ring-blue-500" : ""} ${untracked ? "ring-2 ring-orange-400" : ""} ${draggingId === t.id ? "cursor-grabbing transition-none" : mode === "edit" ? "cursor-grab transition-all duration-150" : "transition-all duration-200"}`}
                  style={{
                    left: `${t.posX ?? 0}%`,
                    top: `${t.posY ?? 0}%`,
                    width: `${t.width ?? 8}%`,
                    height: `${t.height ?? 8}%`,
                    transform: `rotate(${t.rotation ?? 0}deg)`,
                  }}
                >
                  {mode === "live" && pos && (
                    <span className={`absolute -top-2 -right-2 rounded-full px-2 py-0.5 text-[9px] font-semibold border ${longCheck ? "bg-orange-100 text-orange-800 border-orange-300" : "bg-emerald-100 text-emerald-800 border-emerald-300"}`}>
                      {formatMoney(pos.checkTotal)}
                    </span>
                  )}
                  {mode === "live" && untracked && (
                    <span className="absolute -top-2 -left-2 rounded-full px-1.5 py-0.5 text-[9px] font-semibold border bg-orange-100 text-orange-800 border-orange-300">
                      ⚠
                    </span>
                  )}
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
                <div className="grid grid-cols-1 gap-3">
                  <label className="text-sm">Table Name
                    <input
                      type="text"
                      value={selected.name}
                      onChange={e => setTables(prev => prev.map(t => t.id === selected.id ? { ...t, name: e.target.value } : t))}
                      onBlur={e => {
                        const nextName = e.target.value.trim() || `T${selected.id}`;
                        setTables(prev => prev.map(t => t.id === selected.id ? { ...t, name: nextName } : t));
                        updateTable(selected.id, { name: nextName });
                      }}
                      className="mt-1 w-full border rounded px-3 py-2 text-sm"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm">Min Capacity
                    <input
                      type="number"
                      min={1}
                      max={selected.maxCapacity ?? 20}
                      value={selected.minCapacity}
                      onChange={e => setTables(prev => prev.map(t => t.id === selected.id ? { ...t, minCapacity: Number(e.target.value) } : t))}
                      onBlur={e => {
                        const raw = Number(e.target.value);
                        const nextMin = Math.max(1, Math.min(raw || 1, selected.maxCapacity ?? 20));
                        setTables(prev => prev.map(t => t.id === selected.id ? { ...t, minCapacity: nextMin } : t));
                        updateTable(selected.id, { minCapacity: nextMin });
                      }}
                      className="mt-1 w-full border rounded px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="text-sm">Max Capacity
                    <input
                      type="number"
                      min={selected.minCapacity || 1}
                      max={20}
                      value={selected.maxCapacity}
                      onChange={e => setTables(prev => prev.map(t => t.id === selected.id ? { ...t, maxCapacity: Number(e.target.value) } : t))}
                      onBlur={e => {
                        const raw = Number(e.target.value);
                        const floor = selected.minCapacity || 1;
                        const nextMax = Math.max(floor, Math.min(raw || floor, 20));
                        setTables(prev => prev.map(t => t.id === selected.id ? { ...t, maxCapacity: nextMax } : t));
                        updateTable(selected.id, { maxCapacity: nextMax });
                      }}
                      className="mt-1 w-full border rounded px-3 py-2 text-sm"
                    />
                  </label>
                </div>

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
              <div className="flex items-center gap-2"><span className="inline-flex h-4 items-center rounded-full border border-emerald-300 bg-emerald-100 px-1 text-[10px] text-emerald-800">$</span>Open POS check</div>
              <div className="flex items-center gap-2"><span className="inline-flex h-4 items-center rounded-full border border-orange-300 bg-orange-100 px-1 text-[10px] text-orange-800">⚠</span>POS check without reservation</div>
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
              const pos = posStatusMap[detailsId];
              const openMinutes = pos ? minutesSince(pos.openedAt) : null;
              if (!res) return (
                <div>
                  <div className="text-lg font-bold mb-2">Table Details</div>
                  <p className="text-sm text-gray-600 mb-3">No active reservation.</p>
                  {pos && (
                    <div className="rounded-lg border border-orange-200 bg-orange-50 text-orange-800 text-sm p-3 mb-4">
                      <div className="font-semibold">Untracked POS check detected</div>
                      <div className="text-xs mt-1">
                        Open check {formatMoney(pos.checkTotal)}
                        {openMinutes !== null ? ` • ${openMinutes} min` : ""}
                        {pos.serverName ? ` • ${pos.serverName}` : ""}
                      </div>
                    </div>
                  )}
                  {pos && (
                    <button
                      onClick={() => createWalkinFromPos(detailsId)}
                      className="h-11 w-full rounded bg-orange-500 text-white text-sm mb-2 transition-all duration-200"
                    >
                      Create walk-in
                    </button>
                  )}
                  <button onClick={() => setDetailsId(null)} className="h-11 w-full rounded bg-gray-900 text-white text-sm">Close</button>
                </div>
              );
              return (
                <div>
                  <div className="text-lg font-bold mb-1">{res.guestName}</div>
                  <div className="text-sm text-gray-500 mb-4">Party of {res.partySize} · {formatTime12(res.time)} · {res.code}</div>
                  {pos && (
                    <div className="text-xs text-gray-600 mb-3">
                      POS: Open check {formatMoney(pos.checkTotal)}
                      {openMinutes !== null ? ` (${openMinutes} min)` : ""}
                      {pos.serverName ? ` • ${pos.serverName}` : ""}
                    </div>
                  )}
                  {!pos && res.status === "seated" && (
                    <div className="text-xs text-orange-700 mb-3">⚠ No POS check found</div>
                  )}
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
