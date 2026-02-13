"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { HealthStatus, RestaurantPlan, RestaurantStatus } from "@/generated/prisma/client";
import { formatDate } from "@/lib/format";
import { HealthStatusBadge, PlanBadge, RestaurantStatusBadge } from "@/components/status-badge";
import { useToast } from "@/components/toast-provider";
import { useSessionUser } from "@/components/session-provider";

type Row = {
  id: string;
  slug: string;
  name: string;
  domain: string | null;
  ownerEmail: string | null;
  adminEmail: string;
  status: RestaurantStatus;
  plan: RestaurantPlan;
  port: number;
  createdAt: string;
  addonSms: boolean;
  addonFloorPlan: boolean;
  addonReporting: boolean;
  addonGuestHistory: boolean;
  addonEventTicketing: boolean;
  health: {
    status: HealthStatus;
    responseTimeMs: number | null;
    checkedAt: string;
  } | null;
};

function addonCount(row: Row) {
  return [
    row.addonSms,
    row.addonFloorPlan,
    row.addonReporting,
    row.addonGuestHistory,
    row.addonEventTicketing,
  ].filter(Boolean).length;
}

export default function RestaurantsPage() {
  const user = useSessionUser();
  const { showToast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [plan, setPlan] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionBusy, setActionBusy] = useState("");

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

  async function quickToggleStatus(row: Row) {
    const nextStatus = row.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
    setActionBusy(row.id);
    try {
      const res = await fetch(`/api/restaurants/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to update status");
      showToast(`Restaurant ${nextStatus === "ACTIVE" ? "activated" : "suspended"}.`, "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update status", "error");
    } finally {
      setActionBusy("");
    }
  }

  const canManage = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Restaurants</h1>
          <p className="text-sm text-slate-600">Manage plans, licenses, add-ons, and hosted instances.</p>
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
              <th className="px-4 py-3">Restaurant</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Add-ons</th>
              <th className="px-4 py-3">Port</th>
              <th className="px-4 py-3">Health</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">Loading restaurants...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">No restaurants match the current filters.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{row.name}</div>
                    <div className="text-xs text-slate-500">{row.domain || `${row.slug}.reservesit.com`}</div>
                  </td>
                  <td className="px-4 py-3"><PlanBadge plan={row.plan} /></td>
                  <td className="px-4 py-3"><RestaurantStatusBadge status={row.status} /></td>
                  <td className="px-4 py-3 text-slate-700">{addonCount(row)}/5 add-ons</td>
                  <td className="px-4 py-3 text-slate-700">{row.port}</td>
                  <td className="px-4 py-3">
                    {row.health ? (
                      <HealthStatusBadge status={row.health.status} />
                    ) : (
                      <span className="text-xs text-slate-500">No checks</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{formatDate(row.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/dashboard/restaurants/${row.id}`}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                      >
                        View
                      </Link>
                      {canManage ? (
                        <button
                          type="button"
                          onClick={() => void quickToggleStatus(row)}
                          disabled={actionBusy === row.id}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-60"
                        >
                          {actionBusy === row.id ? "Saving..." : row.status === "SUSPENDED" ? "Activate" : "Suspend"}
                        </button>
                      ) : null}
                    </div>
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
