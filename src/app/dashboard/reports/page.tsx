"use client";

import { useEffect, useMemo, useState } from "react";
import AccessDenied from "@/components/access-denied";
import { useHasPermission } from "@/hooks/use-permissions";

interface Stats {
  totalCovers: number;
  totalReservations: number;
  noShows: number;
  noShowRate: number;
  avgCoversPerDay: number;
  avgWaitTime: number;
  avgTableTime: number;
  avgPartySize: number;
  tableTurnover: number;
  guestReturnRate: number;
  reservationRevenue: number;
  eventRevenue: number;
  preOrderRevenue: number;
  peakHours: Array<{ hour: number; count: number }>;
  coversPerDay: Record<string, number>;
  bySource: Record<string, number>;
  byStatus: Record<string, number>;
  waitlist: {
    totalEntries: number;
    avgEstimatedWait: number;
    conversionRate: number;
    seatedCount: number;
  };
  period: { startDate: string; endDate: string };
}

function isoToday(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function shiftIsoDate(dateString: string, deltaDays: number): string {
  const base = new Date(`${dateString}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + deltaDays);
  const y = base.getUTCFullYear();
  const m = String(base.getUTCMonth() + 1).padStart(2, "0");
  const d = String(base.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateLabel(dateString: string): string {
  const parsed = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateString;
  return parsed.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatRevenue(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents || 0) / 100);
}

function percent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function MetricCard({ label, value, subtext, highlight }: { label: string; value: string | number; subtext?: string; highlight?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-xl font-bold sm:text-2xl ${highlight || "text-slate-900"}`}>{value}</p>
      {subtext ? <p className="mt-1 text-xs text-slate-500">{subtext}</p> : null}
    </div>
  );
}

const PRESETS = [
  { key: "today", label: "Today", days: 1 },
  { key: "7", label: "Last 7 Days", days: 7 },
  { key: "30", label: "Last 30 Days", days: 30 },
  { key: "90", label: "Last 90 Days", days: 90 },
] as const;

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-blue-100 text-blue-800",
  confirmed: "bg-blue-100 text-blue-800",
  arrived: "bg-yellow-100 text-yellow-800",
  seated: "bg-emerald-100 text-emerald-800",
  completed: "bg-slate-100 text-slate-800",
  no_show: "bg-rose-100 text-rose-800",
  cancelled: "bg-slate-100 text-slate-700",
  declined: "bg-slate-100 text-slate-700",
};

export default function ReportsPage() {
  const canViewReports = useHasPermission("view_reports");
  const [stats, setStats] = useState<Stats | null>(null);
  const [featureEnabled, setFeatureEnabled] = useState<boolean | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const today = useMemo(() => isoToday(), []);
  const [startDate, setStartDate] = useState(() => shiftIsoDate(isoToday(), -29));
  const [endDate, setEndDate] = useState(() => isoToday());
  const [activePreset, setActivePreset] = useState<(typeof PRESETS)[number]["key"] | "custom">("30");

  if (!canViewReports) return <AccessDenied />;

  useEffect(() => {
    fetch("/api/settings/public")
      .then(r => r.json())
      .then(data => setFeatureEnabled(data.feature_reporting === "true"))
      .catch(() => setFeatureEnabled(false));
  }, []);

  useEffect(() => {
    if (featureEnabled !== true) return;
    setLoadingStats(true);
    const query = new URLSearchParams({ startDate, endDate });
    fetch(`/api/reports/stats?${query.toString()}`)
      .then(r => r.json())
      .then(setStats)
      .finally(() => setLoadingStats(false));
  }, [featureEnabled, startDate, endDate]);

  function applyPreset(days: number, key: (typeof PRESETS)[number]["key"]) {
    const nextEnd = today;
    const nextStart = shiftIsoDate(nextEnd, -(days - 1));
    setStartDate(nextStart);
    setEndDate(nextEnd);
    setActivePreset(key);
  }

  if (featureEnabled === null) {
    return (
      <div className="flex items-center gap-3 text-slate-500">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        Loading...
      </div>
    );
  }

  if (!featureEnabled) {
    return (
      <div className="max-w-3xl">
        <h1 className="mb-4 text-2xl font-bold">Reports</h1>
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-slate-600">Feature not available for your current plan. Contact support to enable Reporting Dashboard.</p>
        </div>
      </div>
    );
  }

  const coversDays = stats
    ? Object.entries(stats.coversPerDay).sort(([a], [b]) => a.localeCompare(b))
    : [];
  const maxCovers = Math.max(...coversDays.map(([, value]) => value), 1);
  const peakHours = stats?.peakHours || [];
  const maxPeakCount = Math.max(...peakHours.map(item => item.count), 1);
  const busiestHours = new Set(
    [...peakHours]
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(item => item.hour)
  );
  const sourceRows = stats
    ? Object.entries(stats.bySource)
        .sort(([, a], [, b]) => b - a)
        .map(([source, count]) => ({ source, count, pct: percent(count, stats.totalReservations) }))
    : [];
  const statusRows = stats
    ? Object.entries(stats.byStatus)
        .sort(([, a], [, b]) => b - a)
        .map(([status, count]) => ({ status, count, pct: percent(count, stats.totalReservations) }))
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm text-slate-500">Performance and service metrics for your selected date range.</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-3 sm:p-5">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(preset => (
            <button
              key={preset.key}
              onClick={() => applyPreset(preset.days, preset.key)}
              className={`rounded-lg px-3 py-2 text-sm transition-all ${
                activePreset === preset.key
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Start Date
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={event => {
                setStartDate(event.target.value);
                setActivePreset("custom");
              }}
              className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm"
            />
          </label>
          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
            End Date
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={today}
              onChange={event => {
                setEndDate(event.target.value);
                setActivePreset("custom");
              }}
              className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm"
            />
          </label>
        </div>
      </section>

      {loadingStats || !stats ? (
        <div className="flex items-center gap-3 text-slate-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          Loading reports...
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-500">
            {stats.period.startDate} to {stats.period.endDate}
          </p>

          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard label="Total Covers" value={stats.totalCovers} />
            <MetricCard label="Reservations" value={stats.totalReservations} />
            <MetricCard label="No-Show Rate" value={`${stats.noShowRate}%`} highlight={stats.noShowRate >= 15 ? "text-rose-700" : ""} subtext={`${stats.noShows} no-shows`} />
            <MetricCard label="Avg Party Size" value={stats.avgPartySize || 0} />
          </section>

          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard label="Avg Wait Time" value={`${stats.avgWaitTime}m`} />
            <MetricCard label="Avg Table Time" value={`${stats.avgTableTime}m`} />
            <MetricCard label="Table Turnover" value={`${stats.tableTurnover}x`} subtext="seatings per table/day" />
            <MetricCard label="Guest Return Rate" value={`${stats.guestReturnRate}%`} />
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-3 sm:p-5">
            <h2 className="text-base font-semibold text-slate-900">Revenue</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MetricCard label="Reservation Revenue" value={formatRevenue(stats.reservationRevenue)} />
              <MetricCard label="Event Revenue" value={formatRevenue(stats.eventRevenue)} />
              <MetricCard label="Pre-Order Revenue" value={formatRevenue(stats.preOrderRevenue)} />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-3 sm:p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Peak Hours</h2>
              <span className="text-xs text-slate-500">Busiest 3 highlighted</span>
            </div>
            <div className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-12 lg:grid-cols-24">
              {peakHours.map(item => {
                const height = Math.max(8, Math.round((item.count / maxPeakCount) * 64));
                const isBusy = busiestHours.has(item.hour) && item.count > 0;
                return (
                  <div key={item.hour} className="flex flex-col items-center">
                    <div
                      className={`w-full rounded-sm ${isBusy ? "bg-blue-600" : "bg-slate-300"}`}
                      style={{ height: `${height}px` }}
                      title={`${item.count} reservations`}
                    />
                    <span className="mt-1 text-[10px] text-slate-500">{item.hour}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-3 sm:p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Covers Per Day</h2>
              <span className="text-xs text-slate-500">Average: {stats.avgCoversPerDay}</span>
            </div>
            {coversDays.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No cover data for this period.</p>
            ) : (
              <div className="mt-4 space-y-2">
                {coversDays.map(([date, covers]) => (
                  <div key={date} className="flex items-center gap-3">
                    <span className="w-20 text-xs text-slate-500 sm:w-24 sm:text-sm">{formatDateLabel(date)}</span>
                    <div className="h-4 flex-1 rounded bg-slate-100">
                      <div className="h-4 rounded bg-blue-500" style={{ width: `${Math.round((covers / maxCovers) * 100)}%` }} />
                    </div>
                    <span className="w-8 text-right text-xs font-medium text-slate-700 sm:w-10 sm:text-sm">{covers}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-5">
              <h2 className="text-base font-semibold text-slate-900">Reservation Status</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {statusRows.map(row => (
                  <span
                    key={row.status}
                    className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[row.status] || "bg-slate-100 text-slate-700"}`}
                  >
                    {row.status.replace(/_/g, " ")}: {row.count} ({row.pct}%)
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-5">
              <h2 className="text-base font-semibold text-slate-900">Source Breakdown</h2>
              <div className="mt-3 space-y-2">
                {sourceRows.map(row => (
                  <div key={row.source} className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium capitalize text-slate-700">{row.source}</span>
                      <span className="text-slate-500">{row.count} ({row.pct}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-5">
              <h2 className="text-base font-semibold text-slate-900">Waitlist</h2>
              <div className="mt-3 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Entries</span>
                  <span className="font-semibold text-slate-900">{stats.waitlist.totalEntries}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Avg Estimated Wait</span>
                  <span className="font-semibold text-slate-900">{stats.waitlist.avgEstimatedWait}m</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Conversion Rate</span>
                  <span className="font-semibold text-slate-900">{stats.waitlist.conversionRate}%</span>
                </div>
                <div className="text-xs text-slate-500">
                  Seated conversions: {stats.waitlist.seatedCount}
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
