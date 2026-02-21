"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

interface OverviewReservation {
  id: number;
  guestName: string;
  partySize: number;
  time: string;
  status: string;
}

interface OverviewPayload {
  today: string;
  rightNow: {
    seatedCount: number;
    arrivedCount: number;
    upcomingCount: number;
    pendingCount: number;
  };
  snapshot: {
    todayCovers: number;
    todayReservations: number;
    waitlistCount: number;
    openPosChecks: number;
  };
  alerts: Array<{
    key: string;
    label: string;
    count: number;
    level: "urgent" | "info";
    href: string;
  }>;
  nextUpcoming: OverviewReservation[];
}

interface TableItem {
  id: number;
  name: string;
  maxCapacity: number;
}

type ReservationSource = "phone" | "walkin" | "staff";

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

function getRoundedNowTime(): string {
  const now = new Date();
  const rounded = new Date(now);
  const minutes = rounded.getMinutes();
  const nextQuarter = Math.ceil(minutes / 15) * 15;
  rounded.setMinutes(nextQuarter, 0, 0);
  return `${String(rounded.getHours()).padStart(2, "0")}:${String(rounded.getMinutes()).padStart(2, "0")}`;
}

function formatTime12(value: string): string {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return value;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return value;
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

function createDefaultForm(today: string, source: ReservationSource = "staff"): ReservationFormState {
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

export default function DashboardOverviewPage() {
  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [tables, setTables] = useState<TableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const [reservationForm, setReservationForm] = useState<ReservationFormState>(createDefaultForm(new Date().toISOString().slice(0, 10)));

  const load = useCallback(async () => {
    setError("");
    try {
      const [overviewResponse, tablesResponse] = await Promise.all([
        fetch("/api/dashboard/overview", { cache: "no-store" }),
        fetch("/api/tables", { cache: "no-store" }),
      ]);

      if (!overviewResponse.ok) {
        const payload = await overviewResponse.json().catch(() => ({}));
        throw new Error(String(payload?.error || "Unable to load dashboard overview."));
      }
      if (!tablesResponse.ok) {
        const payload = await tablesResponse.json().catch(() => ({}));
        throw new Error(String(payload?.error || "Unable to load tables."));
      }

      const overviewPayload = (await overviewResponse.json()) as OverviewPayload;
      const tablesPayload = (await tablesResponse.json()) as TableItem[];
      setOverview(overviewPayload);
      setTables(Array.isArray(tablesPayload) ? tablesPayload : []);
      setReservationForm((prev) => ({
        ...prev,
        date: prev.date || overviewPayload.today,
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard overview.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  function openCreateModal(source: ReservationSource = "staff") {
    const today = overview?.today || new Date().toISOString().slice(0, 10);
    setReservationForm(createDefaultForm(today, source));
    setCreateError("");
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

  const rightNowCards = useMemo(() => {
    if (!overview) return [];
    return [
      { label: "Seated Now", value: overview.rightNow.seatedCount, color: "text-emerald-700", emoji: "🟢" },
      { label: "Waiting", value: overview.rightNow.arrivedCount, color: "text-amber-700", emoji: "🟡" },
      { label: "Upcoming", value: overview.rightNow.upcomingCount, color: "text-blue-700", emoji: "🔵" },
      { label: "Pending", value: overview.rightNow.pendingCount, color: "text-violet-700", emoji: "📋" },
    ];
  }, [overview]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-gray-500">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        Loading dashboard overview...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">Live snapshot for today.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => openCreateModal("staff")}
            className="h-10 w-full rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition-all duration-200 hover:bg-slate-800 sm:w-auto"
          >
            + New Reservation
          </button>
          <button
            type="button"
            onClick={() => openCreateModal("walkin")}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-all duration-200 hover:bg-slate-50 sm:w-auto"
          >
            + Walk-in
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error}
        </div>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Right Now</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {rightNowCards.map((card) => (
            <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-medium text-slate-500">{card.emoji} {card.label}</div>
              <div className={`mt-2 text-2xl font-bold ${card.color}`}>{card.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Today's Snapshot</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium text-slate-500">Total Covers Today</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{overview?.snapshot.todayCovers ?? 0}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium text-slate-500">Reservations Today</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{overview?.snapshot.todayReservations ?? 0}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium text-slate-500">Waitlist Active</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{overview?.snapshot.waitlistCount ?? 0}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium text-slate-500">Open POS Checks</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{overview?.snapshot.openPosChecks ?? 0}</div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">Needs Attention</h2>
        <div className="mt-3 space-y-2">
          {(overview?.alerts || []).length === 0 ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              No urgent issues right now.
            </div>
          ) : (
            (overview?.alerts || []).map((alert) => (
              <Link
                key={alert.key}
                href={alert.href}
                className={`block rounded-lg border-l-4 px-3 py-2 text-sm ${
                  alert.level === "urgent"
                    ? "border-l-amber-500 bg-amber-50 text-amber-900"
                    : "border-l-blue-500 bg-blue-50 text-blue-900"
                }`}
              >
                {alert.label}
              </Link>
            ))
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">Quick Actions</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => openCreateModal("staff")}
            className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition-all duration-200 hover:bg-slate-50"
          >
            + New Reservation
          </button>
          <button
            type="button"
            onClick={() => openCreateModal("walkin")}
            className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition-all duration-200 hover:bg-slate-50"
          >
            + Walk-in
          </button>
          <Link
            href="/dashboard/floorplan"
            className="flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition-all duration-200 hover:bg-slate-50"
          >
            View Floor Plan
          </Link>
          <Link
            href="/dashboard/tonight"
            className="flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition-all duration-200 hover:bg-slate-50"
          >
            View Tonight
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">Upcoming Reservations</h2>
          <Link href="/dashboard?view=upcoming" className="text-sm font-medium text-blue-700 underline">
            View all →
          </Link>
        </div>
        <div className="mt-3 space-y-2">
          {(overview?.nextUpcoming || []).length === 0 ? (
            <p className="text-sm text-slate-500">No upcoming reservations for today.</p>
          ) : (
            (overview?.nextUpcoming || []).map((reservation) => (
              <div key={reservation.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div>
                  <div className="text-sm font-medium text-slate-900">{reservation.guestName || "Guest"}</div>
                  <div className="text-xs text-slate-500">Party of {reservation.partySize}</div>
                </div>
                <div className="text-sm font-semibold text-slate-700">{formatTime12(reservation.time)}</div>
              </div>
            ))
          )}
        </div>
      </section>

      {createModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-4 shadow-xl sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">New Reservation</h2>
                <p className="text-sm text-slate-500">Create and confirm a reservation from the dashboard.</p>
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
                  placeholder="Jane Doe"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-700">Phone</span>
                <input
                  value={reservationForm.guestPhone}
                  onChange={(event) => setReservationForm((prev) => ({ ...prev, guestPhone: event.target.value }))}
                  className="h-11 w-full rounded border border-slate-300 px-3"
                  placeholder="(555) 555-5555"
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block font-medium text-slate-700">Email (optional)</span>
                <input
                  value={reservationForm.guestEmail}
                  onChange={(event) => setReservationForm((prev) => ({ ...prev, guestEmail: event.target.value }))}
                  className="h-11 w-full rounded border border-slate-300 px-3"
                  placeholder="guest@example.com"
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
                <span className="mb-1 block font-medium text-slate-700">Special Requests</span>
                <textarea
                  value={reservationForm.specialRequests}
                  onChange={(event) => setReservationForm((prev) => ({ ...prev, specialRequests: event.target.value }))}
                  className="min-h-[88px] w-full rounded border border-slate-300 px-3 py-2"
                  placeholder="Add notes for the team..."
                />
              </label>
            </div>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {([
                  { key: "phone", label: "Phone Call" },
                  { key: "walkin", label: "Walk-in" },
                  { key: "staff", label: "Staff Entry" },
                ] as Array<{ key: ReservationSource; label: string }>).map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setReservationForm((prev) => ({
                      ...prev,
                      source: option.key,
                      autoApprove: option.key === "walkin" ? true : prev.autoApprove,
                    }))}
                    className={`h-9 rounded-lg border px-3 text-sm ${
                      reservationForm.source === option.key
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-slate-300 bg-white text-slate-700"
                    }`}
                  >
                    {option.label}
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
    </div>
  );
}
