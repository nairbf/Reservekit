"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateTime } from "@/lib/format";
import { HealthStatusBadge } from "@/components/status-badge";

type CheckRow = {
  restaurantId: string;
  name: string;
  slug: string;
  status: "HEALTHY" | "UNHEALTHY" | "UNREACHABLE";
  responseTimeMs: number | null;
  checkedAt: string;
  isActive: boolean;
};

type HealthPayload = {
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
    unreachable: number;
    activeChecked: number;
  };
  checks: CheckRow[];
};

export default function HealthPage() {
  const [data, setData] = useState<HealthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  async function runCheck() {
    setRunning(true);
    setError("");

    try {
      const res = await fetch("/api/health/check-all", { cache: "no-store" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to run health checks");
      }
      const payload = (await res.json()) as HealthPayload;
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run health checks");
    } finally {
      setLoading(false);
      setRunning(false);
    }
  }

  useEffect(() => {
    void runCheck();
    const timer = window.setInterval(() => {
      void runCheck();
    }, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  const longest = useMemo(() => {
    if (!data) return 0;
    return data.checks.reduce((max, row) => Math.max(max, row.responseTimeMs || 0), 0);
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">System Health</h1>
          <p className="text-sm text-slate-600">Checks active restaurant instances every 60 seconds.</p>
        </div>
        <button
          type="button"
          onClick={() => void runCheck()}
          disabled={running}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {running ? "Running..." : "Run Check Now"}
        </button>
      </div>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div> : null}

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Checked</p>
          <p className="mt-1 text-2xl font-semibold">{data?.summary.activeChecked ?? 0}</p>
          <p className="text-xs text-slate-500">of {data?.summary.total ?? 0} restaurants</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-emerald-700">Healthy</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-900">{data?.summary.healthy ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-amber-700">Unhealthy</p>
          <p className="mt-1 text-2xl font-semibold text-amber-900">{data?.summary.unhealthy ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-rose-700">Unreachable</p>
          <p className="mt-1 text-2xl font-semibold text-rose-900">{data?.summary.unreachable ?? 0}</p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">Running first health check...</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {(data?.checks || []).map((row) => (
            <div key={row.restaurantId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                <p className="text-sm font-semibold text-slate-900">{row.name}</p>
                <p className="text-xs text-slate-500">{row.slug}.reservesit.com</p>
              </div>
              <HealthStatusBadge status={row.status} />
            </div>
            <div className="mt-3 space-y-1 text-xs text-slate-600">
              <p>Status Source: {row.isActive ? "Live check" : "Last known (inactive)"}</p>
              <p>Response: {row.responseTimeMs ?? "-"} ms</p>
              <p>Checked: {formatDateTime(row.checkedAt)}</p>
            </div>
              <div className="mt-3 h-1.5 rounded-full bg-slate-100">
                <div
                  className={`h-1.5 rounded-full ${row.status === "HEALTHY" ? "bg-emerald-500" : row.status === "UNHEALTHY" ? "bg-amber-500" : "bg-rose-500"}`}
                  style={{ width: `${longest ? Math.max(8, Math.round(((row.responseTimeMs || 0) / longest) * 100)) : 8}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
