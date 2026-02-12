"use client";

import { useEffect, useMemo, useState } from "react";
import type { RestaurantPlan, RestaurantStatus } from "@/generated/prisma/client";
import { formatDate } from "@/lib/format";
import { PlanBadge, RestaurantStatusBadge } from "@/components/status-badge";

type LicenseRow = {
  id: string;
  name: string;
  slug: string;
  licenseKey: string;
  plan: RestaurantPlan;
  status: RestaurantStatus;
  licenseActivatedAt: string | null;
  createdAt: string;
};

function maskedKey(value: string) {
  if (!value) return "";
  return `${value.slice(0, 6)}••••••••${value.slice(-4)}`;
}

export default function LicensesPage() {
  const [rows, setRows] = useState<LicenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState("");
  const [status, setStatus] = useState("");
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (plan) params.set("plan", plan);
    if (status) params.set("status", status);
    return params.toString();
  }, [search, plan, status]);

  async function load() {
    setError("");
    try {
      const res = await fetch(`/api/licenses${query ? `?${query}` : ""}`, { cache: "no-store" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to load licenses");
      }
      setRows((await res.json()) as LicenseRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load licenses");
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
          <h1 className="text-2xl font-semibold text-slate-900">Licenses</h1>
          <p className="text-sm text-slate-600">Manage keys and export license inventory.</p>
        </div>
        <a
          href="/api/licenses/export"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-slate-700"
        >
          Export CSV
        </a>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search restaurant, slug, key"
          className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
        />
        <select value={plan} onChange={(e) => setPlan(e.target.value)} className="h-11 rounded-lg border border-slate-300 px-3 text-sm">
          <option value="">All plans</option>
          <option value="CORE">CORE</option>
          <option value="SERVICE_PRO">SERVICE PRO</option>
          <option value="FULL_SUITE">FULL SUITE</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-11 rounded-lg border border-slate-300 px-3 text-sm">
          <option value="">All status</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="TRIAL">TRIAL</option>
          <option value="SUSPENDED">SUSPENDED</option>
          <option value="CANCELLED">CANCELLED</option>
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
          Clear
        </button>
      </div>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div> : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Restaurant</th>
              <th className="px-4 py-3">Key</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Activated</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Loading licenses...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">No licenses found.</td></tr>
            ) : (
              rows.map((row) => {
                const revealed = !!showKeys[row.id];
                return (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {row.name}
                      <div className="text-xs text-slate-500">{row.slug}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-800">
                      <div className="flex items-center gap-2">
                        <span>{revealed ? row.licenseKey : maskedKey(row.licenseKey)}</span>
                        <button
                          type="button"
                          onClick={() => setShowKeys((prev) => ({ ...prev, [row.id]: !revealed }))}
                          className="rounded border border-slate-300 px-2 py-0.5 text-[11px] font-semibold"
                        >
                          {revealed ? "Hide" : "Reveal"}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3"><PlanBadge plan={row.plan} /></td>
                    <td className="px-4 py-3"><RestaurantStatusBadge status={row.status} /></td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(row.licenseActivatedAt)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(row.createdAt)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
