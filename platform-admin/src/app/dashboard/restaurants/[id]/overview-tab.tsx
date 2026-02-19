// @ts-nocheck
"use client";

import { formatDate } from "@/lib/format";
import { HostingStatusBadge, PlanBadge, RestaurantStatusBadge } from "@/components/status-badge";

interface OverviewTabProps {
  [key: string]: any;
}

export function OverviewTab(props: OverviewTabProps) {
  const {
    overview,
    setOverview,
    canManage,
    restaurant,
    saveOverview,
    busy,
    canLoginAs,
    loginAsRestaurant,
    notes,
    setNotes,
    saveNotes,
    toggleStatus,
    deleteRestaurant,
  } = props;

  return (
    <div className="space-y-4">
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Restaurant Overview</h2>
          <p className="text-sm text-slate-600">Name, owner contact, and instance metadata.</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Name</span>
            <input value={overview.name} onChange={(e) => setOverview((p: any) => ({ ...p, name: e.target.value }))} disabled={!canManage} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Domain</span>
            <input value={overview.domain} onChange={(e) => setOverview((p: any) => ({ ...p, domain: e.target.value }))} disabled={!canManage} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Owner Name</span>
            <input value={overview.ownerName} onChange={(e) => setOverview((p: any) => ({ ...p, ownerName: e.target.value }))} disabled={!canManage} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Owner Email</span>
            <input value={overview.ownerEmail} onChange={(e) => setOverview((p: any) => ({ ...p, ownerEmail: e.target.value }))} disabled={!canManage} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100" />
          </label>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <label className="block text-xs font-medium text-slate-500">Portal Login Email</label>
            <p className="mt-0.5 text-sm text-slate-700">{overview.ownerEmail || "Not set"}</p>
            <p className="mt-0.5 text-xs text-slate-400">Used to log in at reservesit.com/login</p>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Owner Phone</span>
            <input value={overview.ownerPhone} onChange={(e) => setOverview((p: any) => ({ ...p, ownerPhone: e.target.value }))} disabled={!canManage} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Admin Email</span>
            <input value={overview.adminEmail} onChange={(e) => setOverview((p: any) => ({ ...p, adminEmail: e.target.value }))} disabled={!canManage} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Port</span>
            <input value={overview.port} onChange={(e) => setOverview((p: any) => ({ ...p, port: e.target.value }))} disabled={!canManage} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">DB Path</span>
            <input value={overview.dbPath} onChange={(e) => setOverview((p: any) => ({ ...p, dbPath: e.target.value }))} disabled={!canManage} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100" />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <PlanBadge plan={restaurant.plan} />
          <RestaurantStatusBadge status={restaurant.status} />
          <HostingStatusBadge status={restaurant.hostingStatus} />
          <span className="text-slate-600">Created {formatDate(restaurant.createdAt)}</span>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={overview.hosted} disabled={!canManage} onChange={(e) => setOverview((p: any) => ({ ...p, hosted: e.target.checked }))} />
            Hosted
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={overview.monthlyHostingActive} disabled={!canManage} onChange={(e) => setOverview((p: any) => ({ ...p, monthlyHostingActive: e.target.checked }))} />
            Monthly billing active
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Hosting Status</span>
            <select value={overview.hostingStatus} disabled={!canManage} onChange={(e) => setOverview((p: any) => ({ ...p, hostingStatus: e.target.value }))} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100">
              <option value="ACTIVE">ACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="SELF_HOSTED">SELF_HOSTED</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          {canManage ? (
            <button
              type="button"
              onClick={saveOverview}
              disabled={busy === "save-overview"}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy === "save-overview" ? "Saving..." : "Save Overview"}
            </button>
          ) : null}
          {canLoginAs ? (
            <button
              type="button"
              onClick={loginAsRestaurant}
              disabled={busy === "login-as"}
              className="rounded-lg border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-900 disabled:opacity-60"
            >
              {busy === "login-as" ? "Generating..." : "Login to Dashboard ->"}
            </button>
          ) : null}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Notes</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={saveNotes}
            disabled={busy === "save-notes"}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy === "save-notes" ? "Saving..." : "Save Notes"}
          </button>

          {canManage ? (
            <button
              type="button"
              onClick={toggleStatus}
              disabled={busy === "status"}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
            >
              {busy === "status" ? "Updating..." : restaurant.status === "SUSPENDED" ? "Reactivate" : "Suspend"}
            </button>
          ) : null}

          {canManage ? (
            <button
              type="button"
              onClick={deleteRestaurant}
              disabled={busy === "delete"}
              className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800 disabled:opacity-60"
            >
              {busy === "delete" ? "Deleting..." : "Delete Restaurant"}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
