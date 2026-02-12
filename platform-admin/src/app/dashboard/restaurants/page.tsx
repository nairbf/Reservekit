"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { HealthStatus, RestaurantPlan, RestaurantStatus } from "@/generated/prisma/client";
import { formatDate } from "@/lib/format";
import { HealthStatusBadge, PlanBadge, RestaurantStatusBadge } from "@/components/status-badge";

type Row = {
  id: string;
  slug: string;
  name: string;
  adminEmail: string;
  status: RestaurantStatus;
  plan: RestaurantPlan;
  port: number;
  createdAt: string;
  health: {
    status: HealthStatus;
    responseTimeMs: number | null;
    checkedAt: string;
  } | null;
};

export default function RestaurantsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [plan, setPlan] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (status) params.set("status", status);
    if (plan) params.set("plan", plan);
    return params.toString();
  }, [search, status, plan]);

  async function load() {
    setError("");
    try {
      const res = await fetch(`/api/restaurants${query ? `?${query}` : ""}`, { cache: "no-store" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to load restaurants");
      }
      setRows((await res.json()) as Row[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load restaurants");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Restaurants</h1>
          <p className="text-sm text-slate-600">Manage all customer restaurant instances.</p>
        </div>
        <Link
          href="/dashboard/restaurants/new"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-slate-700"
        >
          Add Restaurant
        </Link>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or slug"
          className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-11 rounded-lg border border-slate-300 px-3 text-sm">
          <option value="">All status</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="TRIAL">TRIAL</option>
          <option value="SUSPENDED">SUSPENDED</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>
        <select value={plan} onChange={(e) => setPlan(e.target.value)} className="h-11 rounded-lg border border-slate-300 px-3 text-sm">
          <option value="">All plans</option>
          <option value="CORE">CORE</option>
          <option value="SERVICE_PRO">SERVICE PRO</option>
          <option value="FULL_SUITE">FULL SUITE</option>
        </select>
        <button
          type="button"
          onClick={() => {
            setSearch("");
            setPlan("");
            setStatus("");
          }}
          className="h-11 rounded-lg border border-slate-300 text-sm font-medium text-slate-700"
        >
          Clear Filters
        </button>
      </div>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div> : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Port</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Health</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">Loading restaurants...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">No restaurants match the current filters.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => router.push(`/dashboard/restaurants/${row.id}`)}
                  className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                  <td className="px-4 py-3 text-slate-700">{row.slug}</td>
                  <td className="px-4 py-3"><PlanBadge plan={row.plan} /></td>
                  <td className="px-4 py-3"><RestaurantStatusBadge status={row.status} /></td>
                  <td className="px-4 py-3 text-slate-700">{row.port}</td>
                  <td className="px-4 py-3 text-slate-700">{formatDate(row.createdAt)}</td>
                  <td className="px-4 py-3">
                    {row.health ? (
                      <HealthStatusBadge status={row.health.status} />
                    ) : (
                      <span className="text-xs text-slate-500">No checks</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
