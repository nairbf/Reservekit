"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { LicenseEventType, RestaurantPlan, RestaurantStatus, HealthStatus } from "@/generated/prisma/client";
import { useSessionUser } from "@/components/session-provider";
import { useToast } from "@/components/toast-provider";
import { formatDate, formatDateTime } from "@/lib/format";
import { HealthStatusBadge, PlanBadge, RestaurantStatusBadge } from "@/components/status-badge";

type RestaurantDetail = {
  id: string;
  slug: string;
  name: string;
  adminEmail: string;
  status: RestaurantStatus;
  plan: RestaurantPlan;
  port: number;
  dbPath: string;
  licenseKey: string;
  licenseActivatedAt: string | null;
  trialEndsAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  monthlyHostingActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  healthChecks: Array<{
    id: string;
    status: HealthStatus;
    responseTimeMs: number | null;
    checkedAt: string;
  }>;
  licenseEvents: Array<{
    id: string;
    event: LicenseEventType;
    details: string | null;
    performedBy: string | null;
    createdAt: string;
  }>;
};

export default function RestaurantDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const user = useSessionUser();
  const { showToast } = useToast();

  const [restaurant, setRestaurant] = useState<RestaurantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");
  const [dirtyNotes, setDirtyNotes] = useState(false);
  const [actionBusy, setActionBusy] = useState("");
  const [editing, setEditing] = useState({
    name: "",
    adminEmail: "",
    plan: "CORE",
    status: "TRIAL",
    monthlyHostingActive: false,
  });

  const canManage = useMemo(() => user.role === "ADMIN" || user.role === "SUPER_ADMIN", [user.role]);
  const noteTimer = useRef<number | undefined>(undefined);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/restaurants/${id}`, { cache: "no-store" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to load restaurant");
      }
      const payload = (await res.json()) as RestaurantDetail;
      setRestaurant(payload);
      setNotes(payload.notes || "");
      setEditing({
        name: payload.name,
        adminEmail: payload.adminEmail,
        plan: payload.plan,
        status: payload.status,
        monthlyHostingActive: payload.monthlyHostingActive,
      });
      setDirtyNotes(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load restaurant");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!restaurant) return;
    if (!dirtyNotes) return;

    window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(async () => {
      try {
        await fetch(`/api/restaurants/${restaurant.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes }),
        });
        setDirtyNotes(false);
        showToast("Notes saved.", "success");
      } catch {
        showToast("Failed to save notes.", "error");
      }
    }, 650);

    return () => {
      window.clearTimeout(noteTimer.current);
    };
  }, [dirtyNotes, notes, restaurant, showToast]);

  async function saveDetails() {
    if (!restaurant) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/restaurants/${restaurant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to update restaurant");

      showToast("Restaurant updated.", "success");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update restaurant");
    } finally {
      setSaving(false);
    }
  }

  async function rotateKey() {
    if (!restaurant) return;
    if (!window.confirm("Rotate this license key? The previous key will stop working.")) return;

    setActionBusy("rotate");
    try {
      const res = await fetch(`/api/restaurants/${restaurant.id}/rotate-key`, { method: "POST" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to rotate key");
      showToast("License key rotated.", "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to rotate key", "error");
    } finally {
      setActionBusy("");
    }
  }

  async function toggleStatus() {
    if (!restaurant) return;
    const nextStatus = restaurant.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
    setActionBusy("status");
    try {
      const res = await fetch(`/api/restaurants/${restaurant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to update status");
      showToast(`Restaurant ${nextStatus === "ACTIVE" ? "reactivated" : "suspended"}.`, "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update status", "error");
    } finally {
      setActionBusy("");
    }
  }

  async function deleteRestaurant() {
    if (!restaurant) return;
    if (!window.confirm(`Delete ${restaurant.name}? This is destructive.`)) return;

    setActionBusy("delete");
    try {
      const res = await fetch(`/api/restaurants/${restaurant.id}`, { method: "DELETE" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to delete restaurant");
      showToast("Restaurant deleted.", "success");
      router.push("/dashboard/restaurants");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete restaurant", "error");
    } finally {
      setActionBusy("");
    }
  }

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-5">Loading restaurant...</div>;
  }

  if (error && !restaurant) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{error}</div>;
  }

  if (!restaurant) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{restaurant.name}</h1>
          <p className="text-sm text-slate-600">{restaurant.slug}.reservesit.com</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`https://${restaurant.slug}.reservesit.com`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
          >
            Open Site
          </a>
          <Link href="/dashboard/restaurants" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700">
            Back
          </Link>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900">Restaurant Details</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Name</span>
              <input
                value={editing.name}
                onChange={(e) => setEditing((prev) => ({ ...prev, name: e.target.value }))}
                disabled={!canManage}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Admin Email</span>
              <input
                value={editing.adminEmail}
                onChange={(e) => setEditing((prev) => ({ ...prev, adminEmail: e.target.value }))}
                disabled={!canManage}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Plan</span>
              <select
                value={editing.plan}
                onChange={(e) => setEditing((prev) => ({ ...prev, plan: e.target.value }))}
                disabled={!canManage}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100"
              >
                <option value="CORE">CORE</option>
                <option value="SERVICE_PRO">SERVICE PRO</option>
                <option value="FULL_SUITE">FULL SUITE</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span>
              <select
                value={editing.status}
                onChange={(e) => setEditing((prev) => ({ ...prev, status: e.target.value }))}
                disabled={!canManage}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="TRIAL">TRIAL</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <PlanBadge plan={restaurant.plan} />
            <RestaurantStatusBadge status={restaurant.status} />
            <span className="text-slate-600">Port: <strong>{restaurant.port}</strong></span>
            <span className="text-slate-600">Created: <strong>{formatDate(restaurant.createdAt)}</strong></span>
            <span className="text-slate-600">DB: <code className="text-xs">{restaurant.dbPath}</code></span>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={editing.monthlyHostingActive}
              onChange={(e) => setEditing((prev) => ({ ...prev, monthlyHostingActive: e.target.checked }))}
              disabled={!canManage}
            />
            Monthly hosting billing active
          </label>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="font-medium text-slate-700">License Key</p>
            <p className="mt-1 break-all font-mono text-xs text-slate-900">{restaurant.licenseKey}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(restaurant.licenseKey);
                  showToast("License key copied.", "success");
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold"
              >
                Copy Key
              </button>
              {canManage ? (
                <button
                  type="button"
                  onClick={rotateKey}
                  disabled={actionBusy === "rotate"}
                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 disabled:opacity-60"
                >
                  {actionBusy === "rotate" ? "Rotating..." : "Rotate Key"}
                </button>
              ) : null}
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Internal Notes (auto-saves)</span>
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setDirtyNotes(true);
              }}
              rows={5}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          {error ? <p className="text-sm text-rose-700">{error}</p> : null}

          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveDetails}
                disabled={saving}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>

              <button
                type="button"
                onClick={toggleStatus}
                disabled={actionBusy === "status"}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
              >
                {restaurant.status === "SUSPENDED" ? "Reactivate" : "Suspend"}
              </button>

              <button
                type="button"
                onClick={deleteRestaurant}
                disabled={actionBusy === "delete"}
                className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800 disabled:opacity-60"
              >
                {actionBusy === "delete" ? "Deleting..." : "Delete"}
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-500">SUPPORT role can edit notes only.</p>
          )}
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Latest Health</h2>
          {restaurant.healthChecks.length === 0 ? (
            <p className="text-sm text-slate-500">No health checks recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {restaurant.healthChecks.slice(0, 8).map((row) => (
                <div key={row.id} className="rounded-lg border border-slate-200 p-2 text-sm">
                  <div className="flex items-center justify-between">
                    <HealthStatusBadge status={row.status} />
                    <span className="text-xs text-slate-500">{formatDateTime(row.checkedAt)}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">Response: {row.responseTimeMs ?? "-"} ms</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Health History (last 50)</h2>
          </div>
          <div className="max-h-72 overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2">Checked</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Response</th>
                </tr>
              </thead>
              <tbody>
                {restaurant.healthChecks.length === 0 ? (
                  <tr><td className="px-4 py-4 text-slate-500" colSpan={3}>No records.</td></tr>
                ) : (
                  restaurant.healthChecks.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="px-4 py-2 text-slate-700">{formatDateTime(row.checkedAt)}</td>
                      <td className="px-4 py-2"><HealthStatusBadge status={row.status} /></td>
                      <td className="px-4 py-2 text-slate-700">{row.responseTimeMs ?? "-"} ms</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">License Event Log</h2>
          </div>
          <div className="max-h-72 overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2">When</th>
                  <th className="px-4 py-2">Event</th>
                  <th className="px-4 py-2">By</th>
                </tr>
              </thead>
              <tbody>
                {restaurant.licenseEvents.length === 0 ? (
                  <tr><td className="px-4 py-4 text-slate-500" colSpan={3}>No events.</td></tr>
                ) : (
                  restaurant.licenseEvents.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="px-4 py-2 text-slate-700">{formatDateTime(row.createdAt)}</td>
                      <td className="px-4 py-2 text-slate-900">
                        {row.event.replaceAll("_", " ")}
                        {row.details ? <div className="text-xs text-slate-500">{row.details}</div> : null}
                      </td>
                      <td className="px-4 py-2 text-slate-700">{row.performedBy || "system"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
