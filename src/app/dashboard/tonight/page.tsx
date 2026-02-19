"use client";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { useHasPermission } from "@/hooks/use-permissions";

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
  preOrder: {
    id: number;
    status: string;
    specialNotes: string | null;
    subtotal: number;
    isPaid: boolean;
    items: Array<{
      id: number;
      guestLabel: string;
      quantity: number;
      specialInstructions: string | null;
      menuItem: {
        id: number;
        name: string;
      };
    }>;
  } | null;
}
interface TableItem { id: number; name: string; maxCapacity: number }
interface UpcomingResponse {
  fromDate: string;
  endDate: string;
  days: number;
  count: number;
  reservations: Reservation[];
}
interface PosStatusEntry {
  tableId: number;
  orderId: string;
  checkTotal: string;
  balanceDue: string;
  serverName: string;
  openedAt: string;
  isOpen: boolean;
}
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

function minutesSince(timestamp: string): number | null {
  if (!timestamp) return null;
  const dt = new Date(timestamp);
  if (Number.isNaN(dt.getTime())) return null;
  return Math.max(0, Math.round((Date.now() - dt.getTime()) / 60000));
}

function formatMoney(value: string): string {
  const num = Number(value);
  if (Number.isFinite(num)) return `$${num.toFixed(2)}`;
  if (!value) return "$0.00";
  return value.startsWith("$") ? value : `$${value}`;
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

function formatDateLabel(value: string): string {
  const dt = new Date(`${value}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function dateInTimezone(timezone: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone || "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const byType = new Map<string, string>();
  for (const part of parts) byType.set(part.type, part.value);
  const year = byType.get("year") || "1970";
  const month = byType.get("month") || "01";
  const day = byType.get("day") || "01";
  return `${year}-${month}-${day}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

export default function TonightPage() {
  const canViewTonight = useHasPermission("tonight_view");
  const searchParams = useSearchParams();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<TableItem[]>([]);
  const [posStatusMap, setPosStatusMap] = useState<Record<number, PosStatusEntry>>({});
  const [upcoming, setUpcoming] = useState<Reservation[]>([]);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [loadingUpcoming, setLoadingUpcoming] = useState(false);
  const [expandedPreOrders, setExpandedPreOrders] = useState<Record<number, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const [today, setToday] = useState(() => dateInTimezone("America/New_York"));
  const [selectedDate, setSelectedDate] = useState(() => dateInTimezone("America/New_York"));
  const showTourHighlight = searchParams.get("fromSetup") === "1" && searchParams.get("tour") === "tonight";

  if (!canViewTonight) return <AccessDenied />;

  const load = useCallback(async () => {
    const [r, t] = await Promise.all([fetch(`/api/reservations?status=all&date=${selectedDate}`), fetch("/api/tables")]);
    setReservations(await r.json());
    setTables(await t.json());
    setLoaded(true);
  }, [selectedDate]);

  const loadUpcoming = useCallback(async () => {
    setLoadingUpcoming(true);
    try {
      const res = await fetch(`/api/reservations/upcoming?fromDate=${selectedDate}&days=14`);
      if (!res.ok) {
        setUpcoming([]);
        return;
      }
      const data = await res.json() as UpcomingResponse;
      setUpcoming(Array.isArray(data.reservations) ? data.reservations : []);
    } finally {
      setLoadingUpcoming(false);
    }
  }, [selectedDate]);

  const loadPosStatus = useCallback(async () => {
    const res = await fetch("/api/spoton/sync");
    if (!res.ok) {
      setPosStatusMap({});
      return;
    }
    const data = await res.json();
    const nextMap: Record<number, PosStatusEntry> = {};
    const list = Array.isArray(data.status) ? data.status as PosStatusEntry[] : [];
    for (const item of list) {
      if (!item || !item.tableId) continue;
      nextMap[item.tableId] = item;
    }
    setPosStatusMap(nextMap);
  }, []);

  useEffect(() => {
    Promise.all([load(), loadPosStatus(), loadUpcoming()]);
    const reservationTimer = setInterval(load, 10000);
    const posTimer = setInterval(loadPosStatus, 30000);
    const upcomingTimer = setInterval(loadUpcoming, 60000);
    return () => {
      clearInterval(reservationTimer);
      clearInterval(posTimer);
      clearInterval(upcomingTimer);
    };
  }, [load, loadPosStatus, loadUpcoming]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/public")
      .then((response) => response.json())
      .then((settings) => {
        if (cancelled) return;
        const timezone = String(settings?.timezone || "America/New_York");
        const localToday = dateInTimezone(timezone);
        setToday(localToday);
        setSelectedDate(localToday);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function doAction(id: number, action: string, extra?: Record<string, unknown>) {
    await fetch(`/api/reservations/${id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
    Promise.all([load(), loadUpcoming()]);
  }

  async function confirmPreOrder(preOrderId: number) {
    await fetch("/api/preorder/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preOrderId }),
    });
    load();
  }

  async function addWalkin() {
    const name = prompt("Guest name:"); if (!name) return;
    const size = prompt("Party size:", "2"); if (!size) return;
    const tid = prompt("Table ID (or leave blank):");
    await fetch("/api/reservations/staff-create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ guestName: name, partySize: parseInt(size), source: "walkin", tableId: tid ? parseInt(tid) : null }) });
    Promise.all([load(), loadUpcoming()]);
  }

  function printDaySheet() {
    const active = reservations
      .filter(r => !["cancelled", "declined", "expired"].includes(r.status))
      .sort((a, b) => a.time.localeCompare(b.time) || a.guestName.localeCompare(b.guestName));
    const covers = active.reduce((sum, r) => sum + r.partySize, 0);

    const rows = active.map(r => {
      const guest = escapeHtml(r.guestName);
      const status = escapeHtml(r.status.replace("_", " "));
      const table = escapeHtml(r.table?.name || "Unassigned");
      const time = escapeHtml(formatTime12(r.time));
      return `<tr><td>${time}</td><td>${guest}</td><td>${r.partySize}</td><td>${table}</td><td>${status}</td><td>${escapeHtml(r.code)}</td></tr>`;
    }).join("");

    const html = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Reservations ${selectedDate}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 24px; color: #111827; }
      h1 { margin: 0 0 4px 0; font-size: 22px; }
      p { margin: 0 0 16px 0; color: #4b5563; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border-bottom: 1px solid #e5e7eb; text-align: left; padding: 8px; }
      th { color: #374151; font-weight: 600; background: #f9fafb; }
      .meta { margin-bottom: 16px; font-size: 12px; color: #6b7280; }
    </style>
  </head>
  <body>
    <h1>Reservation Sheet</h1>
    <p>${escapeHtml(formatDateLabel(selectedDate))} (${escapeHtml(selectedDate)})</p>
    <div class="meta">Total reservations: ${active.length} · Total covers: ${covers}</div>
    <table>
      <thead><tr><th>Time</th><th>Guest</th><th>Party</th><th>Table</th><th>Status</th><th>Ref</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="6">No reservations.</td></tr>`}</tbody>
    </table>
  </body>
</html>`;

    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
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
    <div className={showTourHighlight ? "rounded-2xl ring-2 ring-blue-300 p-2" : ""}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Service Board — {formatDateLabel(selectedDate)}</h1>
          <p className="text-sm text-gray-500">{seatedCovers} seated / {totalCovers} total covers</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowUpcoming(v => !v)}
            className="h-11 px-3 rounded-lg border border-gray-200 bg-white text-sm transition-all duration-200"
          >
            Upcoming ({upcoming.length})
          </button>
          <button
            onClick={printDaySheet}
            className="h-11 px-3 rounded-lg border border-gray-200 bg-white text-sm transition-all duration-200"
            title="Print or Save as PDF"
          >
            Print/PDF
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="h-11 border rounded px-3 text-sm"
          />
          <button
            onClick={() => setSelectedDate(today)}
            className="h-11 px-3 rounded-lg border border-gray-200 bg-white text-sm transition-all duration-200"
          >
            Today
          </button>
          <button onClick={addWalkin} className="h-11 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium transition-all duration-200">+ Walk-in</button>
        </div>
      </div>

      {showUpcoming && (
        <div className="bg-white rounded-xl shadow p-4 mb-6">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="font-semibold">Upcoming Reservations</h2>
            <span className="text-xs text-gray-500">From {formatDateLabel(selectedDate)} · Next 14 days</span>
          </div>
          {loadingUpcoming ? (
            <div className="text-sm text-gray-500">Loading upcoming...</div>
          ) : upcoming.length === 0 ? (
            <div className="text-sm text-gray-500">No upcoming reservations in this window.</div>
          ) : (
            <div className="divide-y border rounded-lg">
              {upcoming.slice(0, 40).map(r => (
                <div key={r.id} className="px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div className="font-medium">{formatDateLabel(r.date)} · {formatTime12(r.time)} · {r.guestName}</div>
                  <div className="text-gray-500">{r.partySize} guests {r.table ? `· ${r.table.name}` : ""}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
            <h2 className="font-bold text-lg mb-2">{formatTime12(time)}</h2>
            <div className="space-y-2">
              {byTime[time].map(r => (
                <div key={r.id} className="bg-white rounded-xl shadow px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SC[r.status] || "bg-gray-100 text-gray-600"}`}>{r.status.replace("_", " ")}</span>
                      <span className="font-medium">{r.guestName}</span>
                      <span className="text-sm text-gray-500">({r.partySize})</span>
                      {r.table && <span className="text-sm text-gray-400">{r.table.name}</span>}
                      {(r.guest?.totalVisits ?? 0) > 1 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">↩ {nth(r.guest?.totalVisits ?? 0)} visit</span>}
                      {r.guest?.vipStatus === "vip" && <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">★ VIP</span>}
                      {r.guest?.allergyNotes && <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700">⚠ Allergies</span>}
                      {r.preOrder && (
                        <button
                          onClick={() => setExpandedPreOrders(prev => ({ ...prev, [r.id]: !prev[r.id] }))}
                          className="text-[11px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 hover:bg-violet-200 transition-all duration-200"
                        >
                          🍽 Starters & Drinks Pre-Ordered{r.preOrder.isPaid ? " (Paid ✓)" : ""}
                        </button>
                      )}
                    </div>
                    {r.table && posStatusMap[r.table.id] && (
                      <div className="text-xs text-emerald-700 mt-1">
                        {`💲 POS: Open check — ${formatMoney(posStatusMap[r.table.id].checkTotal)} (${minutesSince(posStatusMap[r.table.id].openedAt) ?? 0} min)`}
                      </div>
                    )}
                    {r.table && r.status === "seated" && !posStatusMap[r.table.id] && (
                      <div className="text-xs text-orange-700 mt-1">⚠ No POS check found</div>
                    )}
                    {r.preOrder && expandedPreOrders[r.id] && (
                      <div className="mt-2 rounded-lg border border-violet-200 bg-violet-50 p-2 text-xs text-violet-900">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                          <span className="font-semibold">
                            Pre-order {r.preOrder.isPaid ? `(Paid $${(r.preOrder.subtotal / 100).toFixed(2)})` : "(Unpaid)"}
                          </span>
                          {r.preOrder.status !== "confirmed_by_staff" && (
                            <button
                              onClick={() => confirmPreOrder(r.preOrder!.id)}
                              className="h-8 px-2 rounded border border-violet-300 text-violet-800 bg-white"
                            >
                              Confirm
                            </button>
                          )}
                        </div>
                        {Object.entries(
                          (r.preOrder.items || []).reduce<Record<string, Array<typeof r.preOrder.items[number]>>>((acc, item) => {
                            if (!acc[item.guestLabel]) acc[item.guestLabel] = [];
                            acc[item.guestLabel].push(item);
                            return acc;
                          }, {}),
                        ).map(([guestLabel, guestItems]) => (
                          <div key={guestLabel} className="mb-1">
                            <div className="font-medium">{guestLabel}</div>
                            <ul className="list-disc pl-4">
                              {guestItems.map(item => (
                                <li key={item.id}>
                                  {item.quantity}x {item.menuItem.name}
                                  {item.specialInstructions ? ` (${item.specialInstructions})` : ""}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                        {r.preOrder.specialNotes && <div className="mt-1"><span className="font-medium">Notes:</span> {r.preOrder.specialNotes}</div>}
                      </div>
                    )}
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
