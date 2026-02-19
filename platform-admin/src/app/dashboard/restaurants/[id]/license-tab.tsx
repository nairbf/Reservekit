// @ts-nocheck
"use client";

import { formatDate, formatDateTime } from "@/lib/format";
import { HealthStatusBadge, HostingStatusBadge } from "@/components/status-badge";

interface LicenseTabProps {
  [key: string]: any;
}

export function LicenseTab(props: LicenseTabProps) {
  const {
    restaurant,
    showKey,
    setShowKey,
    showToast,
    canManage,
    regenerateKey,
    busy,
    planSelection,
    setPlanSelection,
    applyPlan,
    ADDONS,
    isIncludedInPlan,
    syncStatus,
    toggleAddon,
    healthLatest,
    runHealthCheck,
  } = props;

  return (
    <div className="space-y-4">
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">License Management</h2>
          <p className="text-sm text-slate-600">Control key lifecycle and audit trail.</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">License Key</div>
          <div className="mt-1 break-all font-mono text-xs text-slate-900">{showKey ? restaurant.licenseKey : `${restaurant.licenseKey.slice(0, 8)}••••••••${restaurant.licenseKey.slice(-6)}`}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowKey((v: boolean) => !v)} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold">
              {showKey ? "Hide" : "Reveal"}
            </button>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(restaurant.licenseKey);
                showToast("License key copied.", "success");
              }}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold"
            >
              Copy
            </button>
            {canManage ? (
              <button
                type="button"
                onClick={regenerateKey}
                disabled={busy === "key"}
                className="rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 disabled:opacity-60"
              >
                {busy === "key" ? "Generating..." : "Regenerate Key"}
              </button>
            ) : null}
          </div>
        </div>

        <div className="text-xs text-slate-600">
          <div>Activated: {formatDateTime(restaurant.licenseActivatedAt) || "-"}</div>
          <div>Expires: {formatDate(restaurant.licenseExpiry) || "No expiry"}</div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Plan & Add-ons</h2>
              <p className="text-sm text-slate-600">Change plan tiers and control feature access.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Plan</span>
              <select value={planSelection} onChange={(e) => setPlanSelection(e.target.value)} disabled={!canManage} className="h-10 rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100">
                <option value="CORE">CORE</option>
                <option value="SERVICE_PRO">SERVICE PRO</option>
                <option value="FULL_SUITE">FULL SUITE</option>
              </select>
            </label>
            {canManage ? (
              <button
                type="button"
                onClick={applyPlan}
                disabled={busy === "plan" || planSelection === restaurant.plan}
                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold disabled:opacity-60"
              >
                {busy === "plan" ? "Applying..." : "Apply Plan"}
              </button>
            ) : null}
          </div>

          <div className="space-y-2">
            {ADDONS.map((addon: any) => {
              const value = Boolean(restaurant[addon.key]);
              const included = isIncludedInPlan(restaurant.plan, addon.key);
              const sync = syncStatus[addon.key];
              return (
                <div key={addon.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{addon.label}</div>
                    <div className="text-xs text-slate-500">
                      {addon.price}
                      {included ? " · Included in plan" : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {sync === "synced" ? <span className="text-xs text-emerald-700">Synced</span> : null}
                    {sync === "failed" ? <span className="text-xs text-rose-700">Sync failed</span> : null}
                    <button
                      type="button"
                      disabled={!canManage || busy === addon.key}
                      onClick={() => void toggleAddon(addon.key, !value)}
                      className={`relative h-7 w-12 rounded-full transition-all duration-200 ${value ? "bg-emerald-500" : "bg-slate-300"} disabled:opacity-60`}
                    >
                      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all duration-200 ${value ? "left-5" : "left-0.5"}`} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Hosting & Instance</h2>
            <p className="text-sm text-slate-600">Runtime state and health checks for this customer instance.</p>
          </div>

          <div className="space-y-2 text-sm text-slate-700">
            <div>URL: <a className="text-sky-700 underline" href={`https://${restaurant.domain || `${restaurant.slug}.reservesit.com`}`} target="_blank" rel="noreferrer">{restaurant.domain || `${restaurant.slug}.reservesit.com`}</a></div>
            <div>Port: {restaurant.port}</div>
            <div className="flex items-center gap-2">Hosting status: <HostingStatusBadge status={restaurant.hostingStatus} /></div>
          </div>

          <div className="rounded-xl border border-slate-200 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last Health Check</div>
            {healthLatest ? (
              <div className="mt-2 space-y-1 text-sm text-slate-700">
                <div className="flex items-center gap-2"><HealthStatusBadge status={healthLatest.status} /> <span>{formatDateTime(healthLatest.checkedAt)}</span></div>
                <div>Response: {healthLatest.responseTimeMs ?? "-"} ms</div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No checks recorded yet.</p>
            )}
          </div>

          <button
            type="button"
            onClick={runHealthCheck}
            disabled={busy === "health"}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {busy === "health" ? "Running..." : "Health Check"}
          </button>
        </section>
      </div>
    </div>
  );
}
