"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

interface Reservation {
  id: number;
  code: string;
  guestName: string;
  guestPhone: string;
  guestEmail: string | null;
  partySize: number;
  date: string;
  time: string;
  specialRequests: string | null;
  status: string;
  source: string;
  table: { id: number; name: string } | null;
  guest: {
    id: number;
    totalVisits: number;
    vipStatus: string | null;
    allergyNotes: string | null;
  } | null;
  payment: {
    id: number;
    type: string;
    amount: number;
    status: string;
  } | null;
  preOrder: {
    id: number;
    status: string;
    isPaid: boolean;
    subtotal: number;
  } | null;
}

interface TableItem {
  id: number;
  name: string;
  maxCapacity: number;
}

type SubView = "incoming" | "upcoming" | "all";
type ReservationSource = "phone" | "walkin" | "staff";
type AllStatusFilter = "all" | "confirmed" | "completed" | "no_show" | "cancelled";
type DatePreset = "today" | "last7" | "last30" | "custom";
type AllSort = "date_desc" | "date_asc" | "guest_asc";

interface ReservationFormState {
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  partySize: string;
  date: string;
  time: string;
  durationMin: string;
  tableId: string;
  specialRequests: string;
  source: ReservationSource;
  autoApprove: boolean;
}

const VIEW_LABELS: Record<SubView, string> = {
  incoming: "Incoming",
  upcoming: "Upcoming",
  all: "All Reservations",
};

const STATUS_CLASS: Record<string, string> = {
  pending: "bg-blue-50 text-blue-700",
  counter_offered: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  confirmed: "bg-emerald-50 text-emerald-700",
  arrived: "bg-yellow-50 text-yellow-700",
  seated: "bg-green-50 text-green-700",
  completed: "bg-slate-100 text-slate-700",
  no_show: "bg-red-50 text-red-700",
  cancelled: "bg-slate-100 text-slate-500",
  declined: "bg-slate-100 text-slate-500",
};

function formatTime12(value: string): string {
  const trimmed = String(value || "").trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*([AaPp][Mm]))?$/);
  if (!match) return value;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  if (minute < 0 || minute > 59) return value;

  if (meridiem) {
    if (hour < 1 || hour > 12) return value;
    if (meridiem === "PM" && hour !== 12) hour += 12;
    if (meridiem === "AM" && hour === 12) hour = 0;
  }

  if (hour < 0 || hour > 23) return value;
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

function parseTimeToMinutes(value: string): number {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return Number.MAX_SAFE_INTEGER;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return Number.MAX_SAFE_INTEGER;
  return hour * 60 + minute;
}

function normalizeTimeInput(value: string): string | null {
  const trimmed = String(value || "").trim();
  const hhmm = trimmed.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (hhmm) return `${String(Number(hhmm[1])).padStart(2, "0")}:${hhmm[2]}`;
  const ampm = trimmed.match(/^(\d{1,2}):([0-5]\d)\s*([AaPp][Mm])$/);
  if (!ampm) return null;
  let hour = Number(ampm[1]);
  if (hour < 1 || hour > 12) return null;
  if (ampm[3].toUpperCase() === "PM" && hour !== 12) hour += 12;
  if (ampm[3].toUpperCase() === "AM" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${ampm[2]}`;
}

function formatDateLong(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function addDays(date: string, days: number): string {
  const base = new Date(`${date}T12:00:00`);
  if (Number.isNaN(base.getTime())) return date;
  base.setDate(base.getDate() + days);
  const year = base.getFullYear();
  const month = String(base.getMonth() + 1).padStart(2, "0");
  const day = String(base.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateInTimezone(timezone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

function sectionDateLabel(date: string, today: string): string {
  if (date === today) return "Today";
  if (date === addDays(today, 1)) return "Tomorrow";
  return formatDateLong(date);
}

function getRoundedNowTime(): string {
  const now = new Date();
  const rounded = new Date(now);
  const minutes = rounded.getMinutes();
  const nextQuarter = Math.ceil(minutes / 15) * 15;
  rounded.setMinutes(nextQuarter, 0, 0);
  return `${String(rounded.getHours()).padStart(2, "0")}:${String(rounded.getMinutes()).padStart(2, "0")}`;
}

function cleanText(value: string | null | undefined): string | null {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  if (["0", "n/a", "na", "none", "null", "undefined"].includes(normalized.toLowerCase())) return null;
  return normalized;
}

function formatCents(cents: number): string {
  return `$${(Math.max(0, Math.trunc(cents)) / 100).toFixed(2)}`;
}

function createDefaultReservationForm(today: string, source: ReservationSource = "staff"): ReservationFormState {
  return {
    guestName: "",
    guestPhone: "",
    guestEmail: "",
    partySize: "2",
    date: today,
    time: getRoundedNowTime(),
    durationMin: "",
    tableId: "",
    specialRequests: "",
    source,
    autoApprove: source !== "walkin",
  };
}

export default function ReservationsPage() {
  const searchParams = useSearchParams();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<TableItem[]>([]);
  const [today, setToday] = useState(new Date().toISOString().slice(0, 10));
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [activeView, setActiveView] = useState<SubView>("incoming");
  const [workingAction, setWorkingAction] = useState<{ id: number; label: string } | null>(null);

  const [counterModal, setCounterModal] = useState<{ reservationId: number; guestName: string; timeInput: string; error: string } | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const [reservationForm, setReservationForm] = useState<ReservationFormState>(createDefaultReservationForm(today));

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

  const [expandedUpcoming, setExpandedUpcoming] = useState<Record<number, boolean>>({});
  const [tableSelections, setTableSelections] = useState<Record<number, string>>({});

  const [searchQuery, setSearchQuery] = useState("");
  const [allStatusFilter, setAllStatusFilter] = useState<AllStatusFilter>("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("last30");
  const [customFromDate, setCustomFromDate] = useState("");
  const [customToDate, setCustomToDate] = useState("");
  const [allSort, setAllSort] = useState<AllSort>("date_desc");
  const [visibleCount, setVisibleCount] = useState(30);

  const showTourHighlight = searchParams.get("fromSetup") === "1" && searchParams.get("tour") === "inbox";

  useEffect(() => {
    const viewParam = searchParams.get("view");
    if (viewParam === "incoming" || viewParam === "upcoming" || viewParam === "all") {
      setActiveView(viewParam);
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/public", { cache: "no-store" })
      .then((response) => response.json())
      .then((settings) => {
        if (cancelled) return;
        const timezone = String(settings?.timezone || "America/New_York");
        const localToday = dateInTimezone(timezone);
        setToday(localToday);
        setReservationForm((prev) => ({ ...prev, date: localToday || prev.date }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    setRefreshing(true);
    setLoadError("");
    try {
      const [reservationResponse, tableResponse] = await Promise.all([
        fetch("/api/reservations?status=all", { cache: "no-store" }),
        fetch("/api/tables", { cache: "no-store" }),
      ]);

      if (!reservationResponse.ok) {
        const payload = await reservationResponse.json().catch(() => ({}));
        throw new Error(String(payload?.error || `Reservations feed failed (${reservationResponse.status}).`));
      }
      if (!tableResponse.ok) {
        const payload = await tableResponse.json().catch(() => ({}));
        throw new Error(String(payload?.error || `Tables feed failed (${tableResponse.status}).`));
      }

      const reservationPayload = (await reservationResponse.json()) as Reservation[];
      const tablePayload = (await tableResponse.json()) as TableItem[];
      setReservations(Array.isArray(reservationPayload) ? reservationPayload : []);
      setTables(Array.isArray(tablePayload) ? tablePayload : []);
      setActionError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load reservations.");
      setReservations([]);
      setTables([]);
    } finally {
      setLoaded(true);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15_000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    setVisibleCount(30);
  }, [searchQuery, allStatusFilter, datePreset, customFromDate, customToDate, allSort]);

  async function reservationAction(id: number, action: string, extra?: Record<string, unknown>) {
    setWorkingAction({ id, label: action });
    setActionError("");
    try {
      const response = await fetch(`/api/reservations/${id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setActionError(String(payload?.error || "Unable to update reservation."));
        return false;
      }
      await load();
      return true;
    } catch {
      setActionError("Unable to update reservation.");
      return false;
    } finally {
      setWorkingAction(null);
    }
  }

  async function updateReservation(id: number, data: Record<string, unknown>, actionLabel = "update") {
    setWorkingAction({ id, label: actionLabel });
    setActionError("");
    try {
      const response = await fetch(`/api/reservations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setActionError(String(payload?.error || "Unable to save reservation."));
        return false;
      }
      await load();
      return true;
    } catch {
      setActionError("Unable to save reservation.");
      return false;
    } finally {
      setWorkingAction(null);
    }
  }

  async function submitCounterOffer() {
    if (!counterModal) return;
    const normalizedTime = normalizeTimeInput(counterModal.timeInput);
    if (!normalizedTime) {
      setCounterModal((prev) => (prev ? { ...prev, error: "Enter a valid time like 7:30 PM or 19:30." } : prev));
      return;
    }
    const ok = await reservationAction(counterModal.reservationId, "counter", { newTime: normalizedTime });
    if (ok) setCounterModal(null);
  }

  function openCreateModal(source: ReservationSource = "staff") {
    setCreateError("");
    setReservationForm(createDefaultReservationForm(today, source));
    setCreateModalOpen(true);
  }

  async function submitCreateReservation() {
    const body = {
      guestName: reservationForm.guestName,
      guestPhone: reservationForm.guestPhone,
      guestEmail: reservationForm.guestEmail || undefined,
      partySize: Number(reservationForm.partySize),
      date: reservationForm.date,
      time: reservationForm.time,
      durationMin: reservationForm.durationMin ? Number(reservationForm.durationMin) : undefined,
      tableId: reservationForm.tableId ? Number(reservationForm.tableId) : null,
      specialRequests: reservationForm.specialRequests || undefined,
      source: reservationForm.source,
      autoApprove: reservationForm.source === "walkin" ? true : reservationForm.autoApprove,
    };

    if (!body.guestName || !body.guestPhone || !Number.isFinite(body.partySize) || body.partySize < 1) {
      setCreateError("Guest name, phone, and valid party size are required.");
      return;
    }

    setCreateSaving(true);
    setCreateError("");
    try {
      const response = await fetch("/api/reservations/staff-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setCreateError(String(payload?.error || "Unable to create reservation."));
        return;
      }
      setCreateModalOpen(false);
      await load();
    } catch {
      setCreateError("Unable to create reservation.");
    } finally {
      setCreateSaving(false);
    }
  }

  function openEditModal(reservation: Reservation) {
    setEditError("");
    setEditingReservation({
      id: reservation.id,
      guestName: reservation.guestName || "",
      partySize: Math.max(1, reservation.partySize || 1),
      date: reservation.date || today,
      time: normalizeTimeInput(reservation.time) || "19:00",
      specialRequests: reservation.specialRequests || "",
      tableId: reservation.table?.id ? String(reservation.table.id) : "",
    });
  }

  async function saveEditReservation() {
    if (!editingReservation) return;
    setEditSaving(true);
    setEditError("");
    try {
      const response = await fetch(`/api/reservations/${editingReservation.id}`, {
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
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setEditError(String(payload?.error || "Unable to save reservation changes."));
        return;
      }
      setEditingReservation(null);
      await load();
    } catch {
      setEditError("Unable to save reservation changes.");
    } finally {
      setEditSaving(false);
    }
  }

  const incomingReservations = useMemo(() => {
    return reservations
      .filter((reservation) => reservation.status === "pending" || reservation.status === "counter_offered")
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time);
      });
  }, [reservations]);

  const upcomingReservations = useMemo(() => {
    const endDate = addDays(today, 7);
    return reservations
      .filter((reservation) => ["approved", "confirmed"].includes(reservation.status) && reservation.date >= today && reservation.date <= endDate)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time);
      });
  }, [reservations, today]);

  const upcomingGroups = useMemo(() => {
    const groups = new Map<string, Reservation[]>();
    for (const reservation of upcomingReservations) {
      if (!groups.has(reservation.date)) groups.set(reservation.date, []);
      groups.get(reservation.date)?.push(reservation);
    }
    return Array.from(groups.entries()).map(([date, groupReservations]) => ({ date, reservations: groupReservations }));
  }, [upcomingReservations]);

  const filteredAllReservations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const fromLast7 = addDays(today, -6);
    const fromLast30 = addDays(today, -29);

    function withinDateRange(date: string): boolean {
      if (datePreset === "today") return date === today;
      if (datePreset === "last7") return date >= fromLast7 && date <= today;
      if (datePreset === "last30") return date >= fromLast30 && date <= today;
      if (datePreset === "custom") {
        if (customFromDate && date < customFromDate) return false;
        if (customToDate && date > customToDate) return false;
      }
      return true;
    }

    function statusMatches(status: string): boolean {
      if (allStatusFilter === "all") return true;
      if (allStatusFilter === "confirmed") return ["approved", "confirmed", "arrived", "seated"].includes(status);
      if (allStatusFilter === "completed") return status === "completed";
      if (allStatusFilter === "no_show") return status === "no_show";
      if (allStatusFilter === "cancelled") return ["cancelled", "declined"].includes(status);
      return true;
    }

    const filtered = reservations.filter((reservation) => {
      if (!withinDateRange(reservation.date)) return false;
      if (!statusMatches(reservation.status)) return false;
      if (!query) return true;
      const haystack = [
        reservation.guestName,
        reservation.guestPhone,
        reservation.guestEmail,
        reservation.code,
      ].map((value) => String(value || "").toLowerCase());
      return haystack.some((value) => value.includes(query));
    });

    filtered.sort((a, b) => {
      if (allSort === "guest_asc") {
        const guestCmp = a.guestName.localeCompare(b.guestName);
        if (guestCmp !== 0) return guestCmp;
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time);
      }
      if (allSort === "date_asc") {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time);
      }
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return parseTimeToMinutes(b.time) - parseTimeToMinutes(a.time);
    });

    return filtered;
  }, [reservations, searchQuery, allStatusFilter, datePreset, customFromDate, customToDate, allSort, today]);

  const visibleAllReservations = filteredAllReservations.slice(0, visibleCount);

  if (!loaded) {
    return (
      <div className="flex items-center gap-3 text-slate-500">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        Loading reservations...
      </div>
    );
  }

  return (
    <div className={showTourHighlight ? "rounded-2xl p-2 ring-2 ring-blue-300" : ""}>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reservations</h1>
          <p className="text-sm text-slate-500">
            {activeView === "incoming"
              ? `${incomingReservations.length} incoming request${incomingReservations.length === 1 ? "" : "s"}`
              : activeView === "upcoming"
                ? `${upcomingReservations.length} upcoming reservation${upcomingReservations.length === 1 ? "" : "s"}`
                : `${filteredAllReservations.length} reservation${filteredAllReservations.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => openCreateModal("staff")}
            className="h-10 w-full rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition-all duration-200 hover:bg-slate-800 sm:w-auto"
          >
            + New Reservation
          </button>
          {refreshing ? (
            <div className="flex h-10 items-center gap-2 text-sm text-slate-500">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              Refreshing
            </div>
          ) : null}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(VIEW_LABELS) as SubView[]).map((view) => (
          <button
            key={view}
            type="button"
            onClick={() => setActiveView(view)}
            className={`h-10 rounded-lg px-4 text-sm font-medium transition-all duration-200 ${
              activeView === view
                ? "bg-blue-600 text-white"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {VIEW_LABELS[view]}
          </button>
        ))}
      </div>

      {loadError ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {loadError}
        </div>
      ) : null}

      {actionError ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </div>
      ) : null}

      {activeView === "incoming" ? (
        <div className="space-y-4">
          {incomingReservations.length === 0 ? (
            <div className="rounded-xl bg-white p-8 text-center shadow">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-xl text-emerald-600">✓</div>
              <p className="text-slate-600">No incoming requests. You are all caught up.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {incomingReservations.map((reservation) => {
                const partySize = Math.max(0, reservation.partySize || 0);
                const cleanedEmail = cleanText(reservation.guestEmail);
                const cleanedRequest = cleanText(reservation.specialRequests);
                return (
                  <div key={reservation.id} className="rounded-xl bg-white p-4 shadow sm:p-5">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-bold text-slate-900">{reservation.guestName || "Guest"}</div>
                        <div className="text-sm text-slate-500">Party of {partySize || "?"}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {(reservation.guest?.totalVisits || 0) > 1 ? (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] text-blue-700">
                              ↩ {reservation.guest?.totalVisits} visits
                            </span>
                          ) : null}
                          {reservation.guest?.vipStatus === "vip" ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">★ VIP</span>
                          ) : null}
                          {reservation.guest?.allergyNotes ? (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] text-red-700">⚠ Allergies</span>
                          ) : null}
                          {reservation.payment ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-800">
                              💳 {formatCents(reservation.payment.amount)}
                            </span>
                          ) : null}
                          {reservation.preOrder ? (
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] text-violet-800">
                              🍽 Pre-order {reservation.preOrder.isPaid ? "(Paid ✓)" : ""}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_CLASS[reservation.status] || "bg-slate-100 text-slate-600"}`}>
                          {reservation.status.replace(/_/g, " ")}
                        </span>
                        <div className="mt-1 text-xs text-slate-400">Ref: {reservation.code || "N/A"}</div>
                      </div>
                    </div>

                    <div className="mb-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-slate-400">When</div>
                          <div className="font-medium text-slate-800">{formatDateLong(reservation.date)} at {formatTime12(reservation.time)}</div>
                        </div>
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-slate-400">Phone</div>
                          <div className="font-medium text-slate-800">{cleanText(reservation.guestPhone) || "No phone"}</div>
                        </div>
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-slate-400">Source</div>
                          <div className="font-medium capitalize text-slate-700">{cleanText(reservation.source)?.replace(/_/g, " ") || "Unknown"}</div>
                        </div>
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-slate-400">Party</div>
                          <div className="font-medium text-slate-700">{partySize ? `${partySize} guests` : "Unspecified"}</div>
                        </div>
                        {cleanedEmail ? (
                          <div className="sm:col-span-2">
                            <div className="text-[11px] uppercase tracking-wide text-slate-400">Email</div>
                            <div className="break-all font-medium text-slate-800">{cleanedEmail}</div>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {cleanedRequest ? <div className="mb-3 text-sm text-slate-700">“{cleanedRequest}”</div> : null}
                    {reservation.status === "counter_offered" ? <div className="mb-3 text-sm text-amber-700">Counter-offer sent and waiting for guest response.</div> : null}

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                      <select
                        value={tableSelections[reservation.id] ?? (reservation.table?.id ? String(reservation.table.id) : "")}
                        onChange={(event) => setTableSelections((prev) => ({ ...prev, [reservation.id]: event.target.value }))}
                        className="h-11 rounded border border-slate-300 px-3 text-sm"
                      >
                        <option value="">No table</option>
                        {tables
                          .filter((table) => !partySize || table.maxCapacity >= partySize)
                          .map((table) => (
                            <option key={table.id} value={table.id}>
                              {table.name} ({table.maxCapacity}-top)
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const tableId = tableSelections[reservation.id] ?? (reservation.table?.id ? String(reservation.table.id) : "");
                          reservationAction(reservation.id, "approve", tableId ? { tableId: Number(tableId) } : {});
                        }}
                        className="h-11 w-full rounded bg-emerald-600 text-sm font-medium text-white transition-all duration-200 hover:bg-emerald-500"
                        disabled={workingAction?.id === reservation.id}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => reservationAction(reservation.id, "decline")}
                        className="h-11 w-full rounded bg-red-600 text-sm font-medium text-white transition-all duration-200 hover:bg-red-500"
                        disabled={workingAction?.id === reservation.id}
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        onClick={() => setCounterModal({ reservationId: reservation.id, guestName: reservation.guestName || "Guest", timeInput: formatTime12(reservation.time), error: "" })}
                        className="h-11 w-full rounded bg-amber-500 text-sm font-medium text-white transition-all duration-200 hover:bg-amber-400"
                        disabled={workingAction?.id === reservation.id}
                      >
                        Counter
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {activeView === "upcoming" ? (
        <div className="space-y-5">
          {upcomingGroups.length === 0 ? (
            <div className="rounded-xl bg-white p-8 text-center shadow">
              <p className="text-slate-600">No upcoming confirmed reservations in the next 7 days.</p>
            </div>
          ) : (
            upcomingGroups.map((group) => (
              <div key={group.date} className="space-y-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{sectionDateLabel(group.date, today)}</h2>
                <div className="space-y-2">
                  {group.reservations.map((reservation) => {
                    const expanded = Boolean(expandedUpcoming[reservation.id]);
                    const selectedTable = tableSelections[reservation.id] ?? (reservation.table?.id ? String(reservation.table.id) : "");
                    return (
                      <div key={reservation.id} className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{reservation.guestName || "Guest"} · Party of {reservation.partySize}</div>
                            <div className="text-xs text-slate-500">
                              {formatTime12(reservation.time)} · {reservation.table?.name || "Unassigned table"} · {cleanText(reservation.source)?.replace(/_/g, " ") || "unknown"}
                            </div>
                            {cleanText(reservation.specialRequests) ? (
                              <div className="mt-1 line-clamp-1 text-xs text-slate-600">{reservation.specialRequests}</div>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_CLASS[reservation.status] || "bg-slate-100 text-slate-600"}`}>
                              {reservation.status.replace(/_/g, " ")}
                            </span>
                            <button
                              type="button"
                              onClick={() => setExpandedUpcoming((prev) => ({ ...prev, [reservation.id]: !expanded }))}
                              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700"
                            >
                              {expanded ? "Hide" : "Details"}
                            </button>
                          </div>
                        </div>

                        {expanded ? (
                          <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                            <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                              <div>
                                <span className="text-xs uppercase tracking-wide text-slate-400">Phone</span>
                                <div className="font-medium text-slate-800">{cleanText(reservation.guestPhone) || "No phone"}</div>
                              </div>
                              <div>
                                <span className="text-xs uppercase tracking-wide text-slate-400">Email</span>
                                <div className="font-medium text-slate-800">{cleanText(reservation.guestEmail) || "No email"}</div>
                              </div>
                              <div className="sm:col-span-2">
                                <span className="text-xs uppercase tracking-wide text-slate-400">Special Requests</span>
                                <div className="font-medium text-slate-700">{cleanText(reservation.specialRequests) || "None"}</div>
                              </div>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                              <select
                                value={selectedTable}
                                onChange={(event) => setTableSelections((prev) => ({ ...prev, [reservation.id]: event.target.value }))}
                                className="h-10 w-full rounded border border-slate-300 px-3 text-sm sm:w-56"
                              >
                                <option value="">Unassigned table</option>
                                {tables
                                  .filter((table) => table.maxCapacity >= reservation.partySize)
                                  .map((table) => (
                                    <option key={table.id} value={table.id}>
                                      {table.name} ({table.maxCapacity}-top)
                                    </option>
                                  ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => updateReservation(reservation.id, { tableId: selectedTable ? Number(selectedTable) : null }, "assign")}
                                className="h-10 w-full rounded border border-slate-300 px-3 text-sm font-medium text-slate-700 sm:w-auto"
                                disabled={workingAction?.id === reservation.id}
                              >
                                Assign table
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditModal(reservation)}
                                className="h-10 w-full rounded border border-slate-300 px-3 text-sm font-medium text-slate-700 sm:w-auto"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => reservationAction(reservation.id, "cancel")}
                                className="h-10 w-full rounded border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700 sm:w-auto"
                                disabled={workingAction?.id === reservation.id}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}

      {activeView === "all" ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search guest, phone, email, or code"
                className="h-10 rounded border border-slate-300 px-3 text-sm lg:col-span-2"
              />
              <select
                value={datePreset}
                onChange={(event) => setDatePreset(event.target.value as DatePreset)}
                className="h-10 rounded border border-slate-300 px-3 text-sm"
              >
                <option value="today">Today</option>
                <option value="last7">Last 7 days</option>
                <option value="last30">Last 30 days</option>
                <option value="custom">Custom range</option>
              </select>
              <select
                value={allSort}
                onChange={(event) => setAllSort(event.target.value as AllSort)}
                className="h-10 rounded border border-slate-300 px-3 text-sm"
              >
                <option value="date_desc">Date (newest)</option>
                <option value="date_asc">Date (oldest)</option>
                <option value="guest_asc">Guest Name</option>
              </select>
            </div>

            {datePreset === "custom" ? (
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  type="date"
                  value={customFromDate}
                  onChange={(event) => setCustomFromDate(event.target.value)}
                  className="h-10 rounded border border-slate-300 px-3 text-sm"
                />
                <input
                  type="date"
                  value={customToDate}
                  onChange={(event) => setCustomToDate(event.target.value)}
                  className="h-10 rounded border border-slate-300 px-3 text-sm"
                />
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              {([
                { key: "all", label: "All" },
                { key: "confirmed", label: "Confirmed" },
                { key: "completed", label: "Completed" },
                { key: "no_show", label: "No-Show" },
                { key: "cancelled", label: "Cancelled" },
              ] as Array<{ key: AllStatusFilter; label: string }>).map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setAllStatusFilter(filter.key)}
                  className={`h-9 rounded-full px-3 text-sm ${
                    allStatusFilter === filter.key
                      ? "bg-slate-900 text-white"
                      : "border border-slate-300 bg-white text-slate-700"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {visibleAllReservations.length === 0 ? (
              <div className="rounded-xl bg-white p-8 text-center shadow">
                <p className="text-slate-600">No reservations match these filters.</p>
              </div>
            ) : (
              visibleAllReservations.map((reservation) => {
                const canEdit = !["completed", "cancelled", "declined", "no_show"].includes(reservation.status);
                return (
                  <div key={reservation.id} className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{reservation.guestName || "Guest"} · Party of {reservation.partySize}</div>
                        <div className="text-xs text-slate-500">
                          {formatDateLong(reservation.date)} at {formatTime12(reservation.time)} · {reservation.code || "No code"}
                        </div>
                        <div className="text-xs text-slate-500">{cleanText(reservation.guestPhone) || "No phone"} · {cleanText(reservation.guestEmail) || "No email"}</div>
                      </div>
                      <div className="flex flex-col items-start gap-2 sm:items-end">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_CLASS[reservation.status] || "bg-slate-100 text-slate-600"}`}>
                          {reservation.status.replace(/_/g, " ")}
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(reservation)}
                            className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
                            disabled={!canEdit}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => reservationAction(reservation.id, "cancel")}
                            className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 disabled:opacity-50"
                            disabled={!canEdit || workingAction?.id === reservation.id}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {visibleCount < filteredAllReservations.length ? (
            <button
              type="button"
              onClick={() => setVisibleCount((prev) => prev + 30)}
              className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700"
            >
              Load more
            </button>
          ) : null}
        </div>
      ) : null}

      {counterModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl sm:p-5">
            <div className="mb-3">
              <h2 className="text-lg font-semibold text-slate-900">Propose New Time</h2>
              <p className="text-sm text-slate-500">{counterModal.guestName}</p>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">New time</span>
              <input
                value={counterModal.timeInput}
                onChange={(event) => setCounterModal((prev) => (prev ? { ...prev, timeInput: event.target.value, error: "" } : prev))}
                placeholder="7:30 PM or 19:30"
                className="h-11 w-full rounded border border-slate-300 px-3"
              />
            </label>
            {counterModal.error ? <p className="mt-2 text-sm text-red-600">{counterModal.error}</p> : null}
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setCounterModal(null)}
                className="h-10 w-full rounded border border-slate-300 px-4 text-sm text-slate-700 sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => submitCounterOffer()}
                className="h-10 w-full rounded bg-amber-500 px-4 text-sm font-medium text-white sm:w-auto"
              >
                Send Counter
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {createModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-4 shadow-xl sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">New Reservation</h2>
                <p className="text-sm text-slate-500">Create a reservation from the dashboard.</p>
              </div>
              <button
                type="button"
                onClick={() => !createSaving && setCreateModalOpen(false)}
                className="h-9 w-9 rounded-lg border border-slate-300 text-sm text-slate-600"
                aria-label="Close reservation modal"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-700">Guest Name</span>
                <input
                  value={reservationForm.guestName}
                  onChange={(event) => setReservationForm((prev) => ({ ...prev, guestName: event.target.value }))}
                  className="h-11 w-full rounded border border-slate-300 px-3"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-700">Phone</span>
                <input
                  value={reservationForm.guestPhone}
                  onChange={(event) => setReservationForm((prev) => ({ ...prev, guestPhone: event.target.value }))}
                  className="h-11 w-full rounded border border-slate-300 px-3"
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block font-medium text-slate-700">Email (optional)</span>
                <input
                  value={reservationForm.guestEmail}
                  onChange={(event) => setReservationForm((prev) => ({ ...prev, guestEmail: event.target.value }))}
                  className="h-11 w-full rounded border border-slate-300 px-3"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-700">Party Size</span>
                <input
                  type="number"
                  min={1}
                  value={reservationForm.partySize}
                  onChange={(event) => setReservationForm((prev) => ({ ...prev, partySize: event.target.value }))}
                  className="h-11 w-full rounded border border-slate-300 px-3"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-700">Duration (min)</span>
                <input
                  type="number"
                  min={30}
                  value={reservationForm.durationMin}
                  onChange={(event) => setReservationForm((prev) => ({ ...prev, durationMin: event.target.value }))}
                  className="h-11 w-full rounded border border-slate-300 px-3"
                  placeholder="Default"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-700">Date</span>
                <input
                  type="date"
                  value={reservationForm.date}
                  onChange={(event) => setReservationForm((prev) => ({ ...prev, date: event.target.value }))}
                  className="h-11 w-full rounded border border-slate-300 px-3"
                  disabled={reservationForm.source === "walkin"}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-700">Time</span>
                <input
                  type="time"
                  value={reservationForm.time}
                  onChange={(event) => setReservationForm((prev) => ({ ...prev, time: event.target.value }))}
                  className="h-11 w-full rounded border border-slate-300 px-3"
                  disabled={reservationForm.source === "walkin"}
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block font-medium text-slate-700">Table Assignment (optional)</span>
                <select
                  value={reservationForm.tableId}
                  onChange={(event) => setReservationForm((prev) => ({ ...prev, tableId: event.target.value }))}
                  className="h-11 w-full rounded border border-slate-300 px-3"
                >
                  <option value="">Unassigned</option>
                  {tables.map((table) => (
                    <option key={table.id} value={table.id}>
                      {table.name} ({table.maxCapacity}-top)
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block font-medium text-slate-700">Special Requests / Notes</span>
                <textarea
                  value={reservationForm.specialRequests}
                  onChange={(event) => setReservationForm((prev) => ({ ...prev, specialRequests: event.target.value }))}
                  className="min-h-[88px] w-full rounded border border-slate-300 px-3 py-2"
                />
              </label>
            </div>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {([
                  { key: "phone", label: "Phone Call" },
                  { key: "walkin", label: "Walk-in" },
                  { key: "staff", label: "Staff Entry" },
                ] as Array<{ key: ReservationSource; label: string }>).map((sourceOption) => (
                  <button
                    key={sourceOption.key}
                    type="button"
                    onClick={() => setReservationForm((prev) => ({
                      ...prev,
                      source: sourceOption.key,
                      autoApprove: sourceOption.key === "walkin" ? true : prev.autoApprove,
                    }))}
                    className={`h-9 rounded-lg border px-3 text-sm ${
                      reservationForm.source === sourceOption.key
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-slate-300 bg-white text-slate-700"
                    }`}
                  >
                    {sourceOption.label}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={reservationForm.source === "walkin" ? true : reservationForm.autoApprove}
                  onChange={(event) => setReservationForm((prev) => ({ ...prev, autoApprove: event.target.checked }))}
                  disabled={reservationForm.source === "walkin"}
                />
                Auto-approve
              </label>
            </div>

            {createError ? <p className="mt-3 text-sm text-red-600">{createError}</p> : null}

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="h-10 w-full rounded border border-slate-300 px-4 text-sm text-slate-700 sm:w-auto"
                disabled={createSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => submitCreateReservation()}
                className="h-10 w-full rounded bg-slate-900 px-4 text-sm font-medium text-white transition-all duration-200 hover:bg-slate-800 sm:w-auto"
                disabled={createSaving}
              >
                {createSaving ? "Saving..." : "Create Reservation"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editingReservation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-4 shadow-xl sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Edit Reservation</h2>
                <p className="text-sm text-slate-500">Update guest details, timing, and table assignment.</p>
              </div>
              <button
                type="button"
                onClick={() => !editSaving && setEditingReservation(null)}
                className="h-9 w-9 rounded-lg border border-slate-300 text-sm text-slate-600"
                aria-label="Close edit modal"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block font-medium text-slate-700">Guest Name</span>
                <input
                  value={editingReservation.guestName}
                  onChange={(event) => setEditingReservation((prev) => (prev ? { ...prev, guestName: event.target.value } : prev))}
                  className="h-11 w-full rounded border border-slate-300 px-3"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-700">Date</span>
                <input
                  type="date"
                  value={editingReservation.date}
                  onChange={(event) => setEditingReservation((prev) => (prev ? { ...prev, date: event.target.value } : prev))}
                  className="h-11 w-full rounded border border-slate-300 px-3"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-700">Time</span>
                <input
                  type="time"
                  value={editingReservation.time}
                  onChange={(event) => setEditingReservation((prev) => (prev ? { ...prev, time: event.target.value } : prev))}
                  className="h-11 w-full rounded border border-slate-300 px-3"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-700">Party Size</span>
                <input
                  type="number"
                  min={1}
                  value={editingReservation.partySize}
                  onChange={(event) => {
                    const parsed = Math.max(1, Math.trunc(Number(event.target.value) || 1));
                    setEditingReservation((prev) => (prev ? { ...prev, partySize: parsed } : prev));
                  }}
                  className="h-11 w-full rounded border border-slate-300 px-3"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-700">Table</span>
                <select
                  value={editingReservation.tableId}
                  onChange={(event) => setEditingReservation((prev) => (prev ? { ...prev, tableId: event.target.value } : prev))}
                  className="h-11 w-full rounded border border-slate-300 px-3"
                >
                  <option value="">Unassigned</option>
                  {tables
                    .filter((table) => table.maxCapacity >= editingReservation.partySize)
                    .map((table) => (
                      <option key={table.id} value={table.id}>
                        {table.name} ({table.maxCapacity}-top)
                      </option>
                    ))}
                </select>
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block font-medium text-slate-700">Special Requests</span>
                <textarea
                  value={editingReservation.specialRequests}
                  onChange={(event) => setEditingReservation((prev) => (prev ? { ...prev, specialRequests: event.target.value } : prev))}
                  className="min-h-[88px] w-full rounded border border-slate-300 px-3 py-2"
                />
              </label>
            </div>

            {editError ? <p className="mt-3 text-sm text-red-600">{editError}</p> : null}

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setEditingReservation(null)}
                className="h-10 w-full rounded border border-slate-300 px-4 text-sm text-slate-700 sm:w-auto"
                disabled={editSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => saveEditReservation()}
                className="h-10 w-full rounded bg-slate-900 px-4 text-sm font-medium text-white transition-all duration-200 hover:bg-slate-800 sm:w-auto"
                disabled={editSaving}
              >
                {editSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
