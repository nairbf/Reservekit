"use client";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { useHasPermission } from "@/hooks/use-permissions";

interface Reservation {
  id: number;
  code: string;
  guestName: string;
  guestPhone?: string;
  guestEmail?: string | null;
  partySize: number;
  date: string;
  time: string;
  endTime?: string;
  durationMin?: number;
  specialRequests?: string | null;
  status: string;
  source: string;
  tableId?: number | null;
  table: { id: number; name: string } | null;
  seatedAt?: string | null;
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

interface NoShowRisk {
  score: number;
  level: "low" | "medium" | "high";
  reasons: string[];
}

interface SmartGuestTag {
  label: string;
  color: "blue" | "emerald" | "purple" | "sky" | "amber" | "red";
  detail: string;
}

interface TurnTimeStats {
  overall: number;
  byPartySize: Record<number, number>;
  byTable: Record<number, number>;
}

interface SmartReservationData {
  noShowRisk?: NoShowRisk;
  guestTags?: SmartGuestTag[];
}

interface PacingAlert {
  timeSlot: string;
  reservations: number;
  tableCapacity: number;
  utilizationPct: number;
  level: "warning" | "critical";
  message: string;
}

interface SmartTonightResponse {
  features: {
    smartTurnTime: boolean;
    smartNoShowRisk: boolean;
    smartGuestIntel: boolean;
    smartWaitlistEstimate: boolean;
    smartDailyPrep: boolean;
    smartPacingAlerts: boolean;
  };
  reservations: Record<string, SmartReservationData>;
  turnTimes: TurnTimeStats | null;
  pacingAlerts: PacingAlert[] | null;
  date: string;
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
  const dt = parseDateTime(timestamp);
  if (!dt) return null;
  return Math.max(0, Math.round((Date.now() - dt.getTime()) / 60000));
}

function parseDateTime(value: string | null | undefined): Date | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) return direct;
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const fallback = new Date(normalized);
  if (!Number.isNaN(fallback.getTime())) return fallback;
  return null;
}

function parseTimeToMinutes(value: string): number {
  const match = (value || "").trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return Number.MAX_SAFE_INTEGER;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return Number.MAX_SAFE_INTEGER;
  return hour * 60 + minute;
}

function getPosOpenMinutes(pos: PosStatusEntry | undefined, seatedAt: string | null | undefined): number | null {
  if (!pos) return null;
  const fromPos = minutesSince(pos.openedAt);
  if (fromPos !== null) return fromPos;
  return minutesSince(seatedAt || "");
}

function reservationSortByTime(a: Reservation, b: Reservation): number {
  const aMinutes = parseTimeToMinutes(a.time);
  const bMinutes = parseTimeToMinutes(b.time);
  if (aMinutes !== bMinutes) return aMinutes - bMinutes;
  return a.guestName.localeCompare(b.guestName);
}

function reservationSortByRecentSeated(a: Reservation, b: Reservation): number {
  const aSeated = parseDateTime(a.seatedAt || "")?.getTime() || 0;
  const bSeated = parseDateTime(b.seatedAt || "")?.getTime() || 0;
  if (aSeated !== bSeated) return bSeated - aSeated;
  return reservationSortByTime(a, b);
}

function getReservationFlowSection(status: string): "immediate" | "upcoming" | "seated" | "other" {
  if (status === "arrived" || status === "pending") return "immediate";
  if (status === "approved" || status === "confirmed") return "upcoming";
  if (status === "seated") return "seated";
  return "other";
}

function getImmediatePriority(status: string): number {
  if (status === "arrived") return 0;
  if (status === "pending") return 1;
  return 2;
}

function getEstimatedTurnState(
  reservation: Reservation,
  turnTimes: TurnTimeStats | null,
): { remainingMinutes: number | null; overdueMinutes: number | null } {
  if (reservation.status !== "seated") return { remainingMinutes: null, overdueMinutes: null };
  const seatedAt = parseDateTime(reservation.seatedAt || "");
  if (!seatedAt) return { remainingMinutes: null, overdueMinutes: null };
  const estimatedMinutes =
    (reservation.table?.id ? turnTimes?.byTable?.[reservation.table.id] : undefined)
    || turnTimes?.byPartySize?.[reservation.partySize]
    || turnTimes?.overall
    || 60;
  const elapsed = Math.max(0, Math.round((Date.now() - seatedAt.getTime()) / 60000));
  const remaining = estimatedMinutes - elapsed;
  if (remaining >= 0) return { remainingMinutes: remaining, overdueMinutes: null };
  return { remainingMinutes: 0, overdueMinutes: Math.abs(remaining) };
}

function formatTime12(value: string): string {
  const match = (value || "").trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return value;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return value;
  const h = hour % 12 || 12;
  return `${h}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

function normalizeTimeInput(value: string): string {
  const match = (value || "").trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return "";
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return "";
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatMoney(value: string): string {
  const num = Number(value);
  if (Number.isFinite(num)) return `$${num.toFixed(2)}`;
  if (!value) return "$0.00";
  return value.startsWith("$") ? value : `$${value}`;
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

function getTagClass(color: SmartGuestTag["color"]): string {
  if (color === "purple") return "bg-purple-100 text-purple-700";
  if (color === "emerald") return "bg-emerald-100 text-emerald-700";
  if (color === "sky") return "bg-sky-100 text-sky-700";
  if (color === "amber") return "bg-amber-100 text-amber-800";
  if (color === "red") return "bg-red-100 text-red-700";
  return "bg-blue-100 text-blue-700";
}

function getRiskBadgeClass(level: NoShowRisk["level"]): string {
  if (level === "high") return "bg-red-100 text-red-700";
  if (level === "medium") return "bg-amber-100 text-amber-800";
  return "bg-gray-100 text-gray-600";
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
  const [smartData, setSmartData] = useState<SmartTonightResponse | null>(null);
  const [dismissPacingAlerts, setDismissPacingAlerts] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [today, setToday] = useState(() => dateInTimezone("America/New_York"));
  const [selectedDate, setSelectedDate] = useState(() => dateInTimezone("America/New_York"));
  const [editingReservation, setEditingReservation] = useState<{
    id: number;
    guestName: string;
    partySize: number;
    date: string;
    time: string;
    specialRequests: string;
    tableId: string;
  } | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [walkinModalOpen, setWalkinModalOpen] = useState(false);
  const [walkinForm, setWalkinForm] = useState({
    guestName: "",
    partySize: "2",
    tableId: "",
  });
  const [walkinSaving, setWalkinSaving] = useState(false);
  const [walkinError, setWalkinError] = useState("");
  const [seatModal, setSeatModal] = useState<{
    reservationId: number;
    guestName: string;
    partySize: number;
    tableId: string;
  } | null>(null);
  const [seatSaving, setSeatSaving] = useState(false);
  const [seatError, setSeatError] = useState("");
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

  const loadSmartData = useCallback(async () => {
    try {
      const response = await fetch(`/api/smart/tonight?date=${encodeURIComponent(selectedDate)}`);
      if (!response.ok) return;
      const data = await response.json() as SmartTonightResponse;
      setSmartData(data);
    } catch {
      // ignore
    }
  }, [selectedDate]);

  useEffect(() => {
    Promise.all([load(), loadPosStatus(), loadUpcoming()]);
    loadSmartData();
    const reservationTimer = setInterval(load, 10000);
    const posTimer = setInterval(loadPosStatus, 30000);
    const upcomingTimer = setInterval(loadUpcoming, 60000);
    const smartTimer = setInterval(loadSmartData, 60000);
    return () => {
      clearInterval(reservationTimer);
      clearInterval(posTimer);
      clearInterval(upcomingTimer);
      clearInterval(smartTimer);
    };
  }, [load, loadPosStatus, loadUpcoming, loadSmartData]);

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
    const guestName = walkinForm.guestName.trim();
    const partySize = Math.max(1, Math.trunc(Number(walkinForm.partySize) || 0));
    const tableId = walkinForm.tableId ? Number(walkinForm.tableId) : null;
    if (!guestName) {
      setWalkinError("Guest name is required.");
      return;
    }
    if (!Number.isFinite(partySize) || partySize < 1) {
      setWalkinError("Party size must be at least 1.");
      return;
    }

    setWalkinSaving(true);
    setWalkinError("");
    try {
      const response = await fetch("/api/reservations/staff-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName,
          partySize,
          source: "walkin",
          tableId,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setWalkinError(String(payload?.error || "Unable to add walk-in."));
        return;
      }
      setWalkinModalOpen(false);
      setWalkinForm({ guestName: "", partySize: "2", tableId: "" });
      await Promise.all([load(), loadUpcoming()]);
    } finally {
      setWalkinSaving(false);
    }
  }

  function openSeatModal(reservation: Reservation) {
    setSeatError("");
    setSeatModal({
      reservationId: reservation.id,
      guestName: reservation.guestName || "Guest",
      partySize: Math.max(1, reservation.partySize || 1),
      tableId: reservation.table?.id ? String(reservation.table.id) : "",
    });
  }

  async function confirmSeat() {
    if (!seatModal) return;
    setSeatSaving(true);
    setSeatError("");
    try {
      const tableId = seatModal.tableId ? Number(seatModal.tableId) : null;
      await doAction(
        seatModal.reservationId,
        "seat",
        tableId ? { tableId } : {},
      );
      setSeatModal(null);
    } catch {
      setSeatError("Unable to seat this reservation right now.");
    } finally {
      setSeatSaving(false);
    }
  }

  function openEditModal(reservation: Reservation) {
    setEditError("");
    setEditingReservation({
      id: reservation.id,
      guestName: reservation.guestName || "",
      partySize: Math.max(1, reservation.partySize || 1),
      date: reservation.date || selectedDate,
      time: normalizeTimeInput(reservation.time) || "19:00",
      specialRequests: reservation.specialRequests || "",
      tableId: reservation.table?.id ? String(reservation.table.id) : "",
    });
  }

  function closeEditModal() {
    if (editSaving) return;
    setEditingReservation(null);
    setEditError("");
  }

  async function saveReservationEdit() {
    if (!editingReservation) return;
    setEditSaving(true);
    setEditError("");
    try {
      const res = await fetch(`/api/reservations/${editingReservation.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName: editingReservation.guestName,
          partySize: editingReservation.partySize,
          date: editingReservation.date,
          time: editingReservation.time,
          specialRequests: editingReservation.specialRequests || null,
          tableId: editingReservation.tableId ? Number(editingReservation.tableId) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(String(data?.error || "Unable to save reservation changes."));
        return;
      }
      setEditingReservation(null);
      await Promise.all([load(), loadUpcoming()]);
      loadSmartData();
    } catch {
      setEditError("Unable to save reservation changes.");
    } finally {
      setEditSaving(false);
    }
  }

  const visiblePacingAlerts = smartData?.features?.smartPacingAlerts
    ? (smartData?.pacingAlerts || [])
    : [];

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

  const flowBuckets: Record<"immediate" | "upcoming" | "seated" | "other", Reservation[]> = {
    immediate: [],
    upcoming: [],
    seated: [],
    other: [],
  };
  for (const reservation of activeReservations) {
    const key = getReservationFlowSection(reservation.status);
    flowBuckets[key].push(reservation);
  }

  flowBuckets.immediate.sort((a, b) => {
    const priorityDiff = getImmediatePriority(a.status) - getImmediatePriority(b.status);
    if (priorityDiff !== 0) return priorityDiff;
    return reservationSortByTime(a, b);
  });
  flowBuckets.upcoming.sort(reservationSortByTime);
  flowBuckets.seated.sort(reservationSortByRecentSeated);
  flowBuckets.other.sort(reservationSortByTime);

  const flowSections = [
    { key: "immediate", title: "Arrived & Pending", reservations: flowBuckets.immediate },
    { key: "upcoming", title: "Confirmed & Upcoming", reservations: flowBuckets.upcoming },
    { key: "seated", title: "Seated", reservations: flowBuckets.seated },
    { key: "other", title: "Other Statuses", reservations: flowBuckets.other },
  ].filter((section) => section.reservations.length > 0);

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
          <button
            onClick={() => {
              setWalkinError("");
              setWalkinModalOpen(true);
            }}
            className="h-11 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium transition-all duration-200"
          >
            + Walk-in
          </button>
        </div>
      </div>

      {visiblePacingAlerts.length > 0 && !dismissPacingAlerts && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-amber-900">Pacing alerts for tonight</h2>
            <button
              type="button"
              onClick={() => setDismissPacingAlerts(true)}
              className="text-xs text-amber-800 underline"
            >
              Dismiss
            </button>
          </div>
          <div className="space-y-1 text-sm">
            {visiblePacingAlerts.map((alert) => (
              <div
                key={`${alert.timeSlot}-${alert.level}`}
                className={alert.level === "critical" ? "text-red-700" : "text-amber-800"}
              >
                {alert.level === "critical" ? "⚠ Overbooked: " : "📊 Nearly full: "}
                {formatTime12(alert.timeSlot)} has {alert.reservations} reservations for {alert.tableCapacity} tables
              </div>
            ))}
          </div>
        </div>
      )}

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
        {flowSections.map((section) => (
          <div key={section.key}>
            <h2 className="mb-2 text-lg font-bold">{section.title}</h2>
            <div className="space-y-2">
              {section.reservations.map((r) => (
                <div key={r.id} className="bg-white rounded-xl shadow px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    {(() => {
                      const smartEntry = smartData?.reservations?.[String(r.id)];
                      const noShowRisk = smartData?.features?.smartNoShowRisk ? smartEntry?.noShowRisk : undefined;
                      const guestTags = smartData?.features?.smartGuestIntel ? (smartEntry?.guestTags || []) : [];
                      const turnTimes = smartData?.features?.smartTurnTime ? smartData?.turnTimes : null;
                      const pos = r.table ? posStatusMap[r.table.id] : undefined;
                      const posOpenMinutes = getPosOpenMinutes(pos, r.seatedAt);
                      const turnState = getEstimatedTurnState(r, turnTimes);
                      return (
                        <>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SC[r.status] || "bg-gray-100 text-gray-600"}`}>{r.status.replace("_", " ")}</span>
                      <span className="font-medium">{r.guestName}</span>
                      <span className="text-sm text-gray-500">({r.partySize})</span>
                      <span className="text-sm text-gray-500">{formatTime12(r.time)}</span>
                      {r.table && <span className="text-sm text-gray-400">{r.table.name}</span>}
                      {(r.guest?.totalVisits ?? 0) > 1 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">↩ {nth(r.guest?.totalVisits ?? 0)} visit</span>}
                      {r.guest?.vipStatus === "vip" && <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">★ VIP</span>}
                      {r.guest?.allergyNotes && <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700">⚠ Allergies</span>}
                      {noShowRisk && noShowRisk.level !== "low" && r.status !== "seated" ? (
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full ${getRiskBadgeClass(noShowRisk.level)}`}
                          title={noShowRisk.reasons.join(" · ")}
                        >
                          ⚠ No-show risk ({noShowRisk.score})
                        </span>
                      ) : null}
                      {guestTags.map((tag) => (
                        <span
                          key={`${r.id}-${tag.label}`}
                          className={`text-[11px] px-2 py-0.5 rounded-full ${getTagClass(tag.color)}`}
                          title={tag.detail}
                        >
                          {tag.label}
                        </span>
                      ))}
                      {r.preOrder && (
                        <button
                          onClick={() => setExpandedPreOrders(prev => ({ ...prev, [r.id]: !prev[r.id] }))}
                          className="text-[11px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 hover:bg-violet-200 transition-all duration-200"
                        >
                          🍽 Starters & Drinks Pre-Ordered{r.preOrder.isPaid ? " (Paid ✓)" : ""}
                        </button>
                      )}
                    </div>
                    {r.table && pos && (
                      <div className="text-xs text-emerald-700 mt-1">
                        {`💲 POS: Open check — ${formatMoney(pos.checkTotal)}${posOpenMinutes !== null ? ` (${posOpenMinutes} min)` : ""}`}
                      </div>
                    )}
                    {smartData?.features?.smartTurnTime && r.status === "seated" && (
                      <div className="text-xs text-gray-500 mt-1">
                        {turnState.remainingMinutes === null
                          ? "Est. availability pending"
                          : turnState.overdueMinutes && turnState.overdueMinutes > 0
                            ? (turnState.overdueMinutes >= 10
                              ? `Overdue by ${turnState.overdueMinutes} min`
                              : "Should be available now")
                            : `Est. ${turnState.remainingMinutes} min remaining`}
                      </div>
                    )}
                    {r.table && r.status === "seated" && !pos && (
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
                        </>
                      );
                    })()}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!["completed", "cancelled"].includes(r.status) && (
                      <button
                        onClick={() => openEditModal(r)}
                        className="h-11 sm:h-9 px-4 sm:px-3 rounded bg-white text-gray-700 border border-gray-200 text-xs transition-all duration-200"
                      >
                        Edit
                      </button>
                    )}
                    {(["approved", "confirmed"].includes(r.status)) && (
                      <button onClick={() => doAction(r.id, "arrive")} className="h-11 sm:h-9 px-4 sm:px-3 rounded bg-yellow-50 text-yellow-800 border border-yellow-200 text-xs transition-all duration-200">Arrived</button>
                    )}
                    {(["arrived", "approved", "confirmed"].includes(r.status)) && (
                      <button
                        onClick={() => openSeatModal(r)}
                        className="h-11 sm:h-9 px-4 sm:px-3 rounded bg-green-50 text-green-800 border border-green-200 text-xs transition-all duration-200"
                      >
                        Seat
                      </button>
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

      {flowSections.length === 0 && (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">No reservations for today yet.</div>
      )}

      {walkinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Add Walk-in</h2>
                <p className="text-xs text-gray-500">Create a walk-in reservation for the service board.</p>
              </div>
              <button
                type="button"
                onClick={() => !walkinSaving && setWalkinModalOpen(false)}
                className="h-9 w-9 rounded border border-gray-200 text-gray-600"
                aria-label="Close walk-in modal"
              >
                X
              </button>
            </div>
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">Guest name</span>
                <input
                  value={walkinForm.guestName}
                  onChange={(event) => setWalkinForm((prev) => ({ ...prev, guestName: event.target.value }))}
                  className="h-10 w-full rounded border border-gray-300 px-3 text-sm"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-gray-700">Party size</span>
                  <input
                    type="number"
                    min={1}
                    value={walkinForm.partySize}
                    onChange={(event) => setWalkinForm((prev) => ({ ...prev, partySize: event.target.value }))}
                    className="h-10 w-full rounded border border-gray-300 px-3 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-gray-700">Table</span>
                  <select
                    value={walkinForm.tableId}
                    onChange={(event) => setWalkinForm((prev) => ({ ...prev, tableId: event.target.value }))}
                    className="h-10 w-full rounded border border-gray-300 px-3 text-sm"
                  >
                    <option value="">Unassigned</option>
                    {tables.map((table) => (
                      <option key={table.id} value={table.id}>
                        {table.name} ({table.maxCapacity}-top)
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            {walkinError && <p className="mt-3 text-sm text-red-600">{walkinError}</p>}
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setWalkinModalOpen(false)}
                className="h-10 w-full rounded border border-gray-300 px-4 text-sm text-gray-700 sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addWalkin}
                disabled={walkinSaving}
                className="h-10 w-full rounded bg-blue-600 px-4 text-sm font-medium text-white transition-all duration-200 disabled:opacity-60 sm:w-auto"
              >
                {walkinSaving ? "Adding..." : "Add walk-in"}
              </button>
            </div>
          </div>
        </div>
      )}

      {seatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Seat Reservation</h2>
                <p className="text-xs text-gray-500">{seatModal.guestName}</p>
              </div>
              <button
                type="button"
                onClick={() => !seatSaving && setSeatModal(null)}
                className="h-9 w-9 rounded border border-gray-200 text-gray-600"
                aria-label="Close seat modal"
              >
                X
              </button>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">Assign table (optional)</span>
              <select
                value={seatModal.tableId}
                onChange={(event) => setSeatModal((prev) => (prev ? { ...prev, tableId: event.target.value } : prev))}
                className="h-10 w-full rounded border border-gray-300 px-3 text-sm"
              >
                <option value="">Unassigned</option>
                {tables
                  .filter((table) => table.maxCapacity >= seatModal.partySize)
                  .map((table) => (
                    <option key={table.id} value={table.id}>
                      {table.name} ({table.maxCapacity}-top)
                    </option>
                  ))}
              </select>
            </label>
            {seatError && <p className="mt-3 text-sm text-red-600">{seatError}</p>}
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setSeatModal(null)}
                className="h-10 w-full rounded border border-gray-300 px-4 text-sm text-gray-700 sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSeat}
                disabled={seatSaving}
                className="h-10 w-full rounded bg-green-600 px-4 text-sm font-medium text-white transition-all duration-200 disabled:opacity-60 sm:w-auto"
              >
                {seatSaving ? "Seating..." : "Confirm Seat"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingReservation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-4 shadow-xl sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Edit Reservation</h2>
                <p className="text-xs text-gray-500">Update booking details and table assignment.</p>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="h-9 w-9 rounded border border-gray-200 text-gray-600"
                aria-label="Close edit modal"
              >X</button>
            </div>

            <div className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">Guest name</span>
                <input
                  value={editingReservation.guestName}
                  onChange={(event) => setEditingReservation((prev) => (prev ? { ...prev, guestName: event.target.value } : prev))}
                  className="h-10 w-full rounded border border-gray-300 px-3 text-sm"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-gray-700">Date</span>
                  <input
                    type="date"
                    value={editingReservation.date}
                    onChange={(event) => setEditingReservation((prev) => (prev ? { ...prev, date: event.target.value } : prev))}
                    className="h-10 w-full rounded border border-gray-300 px-3 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-gray-700">Time</span>
                  <input
                    type="time"
                    value={editingReservation.time}
                    onChange={(event) => setEditingReservation((prev) => (prev ? { ...prev, time: event.target.value } : prev))}
                    className="h-10 w-full rounded border border-gray-300 px-3 text-sm"
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-gray-700">Party size</span>
                  <input
                    type="number"
                    min={1}
                    value={editingReservation.partySize}
                    onChange={(event) => {
                      const parsed = Math.max(1, Math.trunc(Number(event.target.value) || 1));
                      setEditingReservation((prev) => (prev ? { ...prev, partySize: parsed } : prev));
                    }}
                    className="h-10 w-full rounded border border-gray-300 px-3 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-gray-700">Table</span>
                  <select
                    value={editingReservation.tableId}
                    onChange={(event) => setEditingReservation((prev) => (prev ? { ...prev, tableId: event.target.value } : prev))}
                    className="h-10 w-full rounded border border-gray-300 px-3 text-sm"
                  >
                    <option value="">Unassigned</option>
                    {tables.map((table) => (
                      <option key={table.id} value={table.id}>
                        {table.name} ({table.maxCapacity}-top)
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">Special requests</span>
                <textarea
                  rows={3}
                  value={editingReservation.specialRequests}
                  onChange={(event) => setEditingReservation((prev) => (prev ? { ...prev, specialRequests: event.target.value } : prev))}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
            </div>

            {editError && <p className="mt-3 text-sm text-red-600">{editError}</p>}

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeEditModal}
                className="h-10 w-full rounded border border-gray-300 px-4 text-sm text-gray-700 sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveReservationEdit}
                disabled={editSaving}
                className="h-10 w-full rounded bg-blue-600 px-4 text-sm font-medium text-white transition-all duration-200 disabled:opacity-60 sm:w-auto"
              >
                {editSaving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
