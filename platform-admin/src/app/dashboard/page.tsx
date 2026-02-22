"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDateTime, formatMoney } from "@/lib/format";
import { HealthStatusBadge, PlanBadge, RestaurantStatusBadge } from "@/components/status-badge";

type OverviewResponse = {
  totals: {
    restaurants: number;
    activeRestaurants: number;
    oneTimeRevenue: number;
    monthlyRevenue: number;
    totalRevenue: number;
  };
  byPlan: Record<"CORE" | "SERVICE_PRO" | "FULL_SUITE", number>;
  byStatus: Record<"ACTIVE" | "SUSPENDED" | "TRIAL" | "CANCELLED", number>;
  healthSummary: Record<"HEALTHY" | "UNHEALTHY" | "UNREACHABLE", number>;
  recentLicenseEvents: Array<{
    id: string;
    event: string;
    details: string | null;
    performedBy: string | null;
    createdAt: string;
    restaurant: {
      id: string;
      name: string;
      slug: string;
    } | null;
  }>;
};

function emptyOverview(): OverviewResponse {
  return {
    totals: {
      restaurants: 0,
      activeRestaurants: 0,
      oneTimeRevenue: 0,
      monthlyRevenue: 0,
      totalRevenue: 0,
    },
    byPlan: {
      CORE: 0,
      SERVICE_PRO: 0,
      FULL_SUITE: 0,
    },
    byStatus: {
      ACTIVE: 0,
      SUSPENDED: 0,
      TRIAL: 0,
      CANCELLED: 0,
    },
    healthSummary: {
      HEALTHY: 0,
      UNHEALTHY: 0,
      UNREACHABLE: 0,
    },
    recentLicenseEvents: [],
  };
}

function normalizeOverview(payload: unknown): OverviewResponse {
  const base = emptyOverview();
  if (!payload || typeof payload !== "object") return base;

  const row = payload as Partial<OverviewResponse>;
  return {
    totals: {
      restaurants: Number(row.totals?.restaurants || 0),
      activeRestaurants: Number(row.totals?.activeRestaurants || 0),
      oneTimeRevenue: Number(row.totals?.oneTimeRevenue || 0),
      monthlyRevenue: Number(row.totals?.monthlyRevenue || 0),
      totalRevenue: Number(row.totals?.totalRevenue || 0),
    },
    byPlan: {
      CORE: Number(row.byPlan?.CORE || 0),
      SERVICE_PRO: Number(row.byPlan?.SERVICE_PRO || 0),
      FULL_SUITE: Number(row.byPlan?.FULL_SUITE || 0),
    },
    byStatus: {
      ACTIVE: Number(row.byStatus?.ACTIVE || 0),
      SUSPENDED: Number(row.byStatus?.SUSPENDED || 0),
      TRIAL: Number(row.byStatus?.TRIAL || 0),
      CANCELLED: Number(row.byStatus?.CANCELLED || 0),
    },
    healthSummary: {
      HEALTHY: Number(row.healthSummary?.HEALTHY || 0),
      UNHEALTHY: Number(row.healthSummary?.UNHEALTHY || 0),
      UNREACHABLE: Number(row.healthSummary?.UNREACHABLE || 0),
    },
    recentLicenseEvents: Array.isArray(row.recentLicenseEvents)
      ? row.recentLicenseEvents.map((event) => ({
        id: String(event.id || ""),
        event: String(event.event || ""),
        details: event.details || null,
        performedBy: event.performedBy || null,
        createdAt: String(event.createdAt || ""),
        restaurant: event.restaurant
          ? {
            id: String(event.restaurant.id || ""),
            name: String(event.restaurant.name || ""),
            slug: String(event.restaurant.slug || ""),
          }
          : null,
      }))
      : [],
  };
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max === 0 ? 0 : Math.max(6, Math.round((value / max) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-slate-700">{label}</span>
        <span className="font-medium text-slate-900">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-sky-500" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export default function DashboardOverviewPage() {
  const [data, setData] = useState<OverviewResponse>(emptyOverview());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setError(null);
    try {
      const res = await fetch("/api/dashboard/overview", { cache: "no-store" });
      if (!res.ok) {
        setError("Using fallback data while overview service recovers.");
        setData(emptyOverview());
        return;
      }
      const payload = await res.json().catch(() => ({}));
      setData(normalizeOverview(payload));
    } catch (err) {
      console.error("[PLATFORM DASHBOARD] Overview fetch failed", err);
      setError("Using fallback data while overview service recovers.");
      setData(emptyOverview());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-5">Loading overview...</div>;
  }

  const maxPlan = Math.max(...Object.values(data.byPlan), 0);
  const maxStatus = Math.max(...Object.values(data.byStatus), 0);

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {error}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Platform Overview</h1>
          <p className="text-sm text-slate-600">Real-time snapshot of customer and license operations.</p>
        </div>
        <Link
          href="/dashboard/restaurants/new"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-slate-700"
        >
          Add Restaurant
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total Restaurants" value={String(data.totals.restaurants)} />
        <StatCard label="Active Restaurants" value={String(data.totals.activeRestaurants)} />
        <StatCard label="One-Time Revenue" value={formatMoney(data.totals.oneTimeRevenue)} />
        <StatCard label="Monthly Hosting" value={formatMoney(data.totals.monthlyRevenue)} />
        <StatCard label="Total Revenue" value={formatMoney(data.totals.totalRevenue)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">By Plan</h2>
          <div className="mt-3 space-y-3">
            {Object.entries(data.byPlan).map(([plan, value]) => (
              <div key={plan}>
                <div className="mb-1"><PlanBadge plan={plan as "CORE" | "SERVICE_PRO" | "FULL_SUITE"} /></div>
                <BarRow label={plan.replaceAll("_", " ")} value={value} max={maxPlan} />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">By Status</h2>
          <div className="mt-3 space-y-3">
            {Object.entries(data.byStatus).map(([status, value]) => (
              <div key={status}>
                <div className="mb-1">
                  <RestaurantStatusBadge status={status as "ACTIVE" | "SUSPENDED" | "TRIAL" | "CANCELLED"} />
                </div>
                <BarRow label={status.replaceAll("_", " ")} value={value} max={maxStatus} />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">System Health Summary</h2>
          <div className="mt-3 space-y-3">
            {Object.entries(data.healthSummary).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between rounded-lg border border-slate-200 p-2">
                <HealthStatusBadge status={status as "HEALTHY" | "UNHEALTHY" | "UNREACHABLE"} />
                <span className="text-sm font-semibold">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Recent License Events</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Restaurant</th>
                <th className="px-4 py-2">Event</th>
                <th className="px-4 py-2">Details</th>
                <th className="px-4 py-2">Performed By</th>
              </tr>
            </thead>
            <tbody>
              {data.recentLicenseEvents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    No license events yet.
                  </td>
                </tr>
              ) : (
                data.recentLicenseEvents.map((event) => (
                  <tr key={event.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-slate-600">{formatDateTime(event.createdAt)}</td>
                    <td className="px-4 py-2 font-medium text-slate-900">
                      {event.restaurant?.name || "Unknown restaurant"}
                      {event.restaurant?.slug ? (
                        <span className="ml-2 text-xs text-slate-500">({event.restaurant.slug})</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2">{event.event.replaceAll("_", " ")}</td>
                    <td className="px-4 py-2 text-slate-600">{event.details || "-"}</td>
                    <td className="px-4 py-2 text-slate-600">{event.performedBy || "system"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
