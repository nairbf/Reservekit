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
  provisionStatus?: string | null;
  generatedPassword?: string | null;
};

type ProvisionResponse = {
  id: string;
  name: string;
  slug: string;
  url: string;
  ownerEmail: string;
  password: string;
  licenseKey: string;
  plan: RestaurantPlan;
  port: number;
  provisionStatus: string;
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

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
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
  const [showProvisionForm, setShowProvisionForm] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [provisionName, setProvisionName] = useState("");
  const [provisionSlug, setProvisionSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [provisionOwnerEmail, setProvisionOwnerEmail] = useState("");
  const [provisionPlan, setProvisionPlan] = useState<RestaurantPlan>("CORE");
  const [provisionPort, setProvisionPort] = useState("3003");
  const [provisionError, setProvisionError] = useState("");
  const [provisionSuccess, setProvisionSuccess] = useState<ProvisionResponse | null>(null);
  const [retryPayload, setRetryPayload] = useState<{
    name: string;
    slug: string;
    ownerEmail: string;
    plan: RestaurantPlan;
    port: number;
  } | null>(null);

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

  useEffect(() => {
    if (slugEdited) return;
    setProvisionSlug(slugify(provisionName));
  }, [provisionName, slugEdited]);

  async function loadNextPort() {
    try {
      const res = await fetch("/api/restaurants/next-port", { cache: "no-store" });
      if (!res.ok) return;
      const payload = (await res.json()) as { port?: number };
      if (payload?.port) {
        setProvisionPort(String(payload.port));
      }
    } catch {
      // Ignore helper failures. The form still accepts manual entry.
    }
  }

  useEffect(() => {
    if (!showProvisionForm) return;
    void loadNextPort();
  }, [showProvisionForm]);

  function resetProvisionForm() {
    setProvisionName("");
    setProvisionSlug("");
    setSlugEdited(false);
    setProvisionOwnerEmail("");
    setProvisionPlan("CORE");
    setProvisionPort("3003");
  }

  async function provisionRestaurant(override?: {
    name: string;
    slug: string;
    ownerEmail: string;
    plan: RestaurantPlan;
    port: number;
  }) {
    const payload = override || {
      name: provisionName.trim(),
      slug: slugify(provisionSlug.trim()),
      ownerEmail: provisionOwnerEmail.trim().toLowerCase(),
      plan: provisionPlan,
      port: Number(provisionPort),
    };

    if (!payload.name || !payload.slug || !payload.ownerEmail || !payload.port) {
      setProvisionError("Name, slug, owner email, and port are required.");
      setRetryPayload(payload);
      return;
    }

    if (!/^[a-z0-9-]+$/.test(payload.slug)) {
      setProvisionError("Slug must be lowercase letters, numbers, and hyphens only.");
      setRetryPayload(payload);
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.ownerEmail)) {
      setProvisionError("Owner email is invalid.");
      setRetryPayload(payload);
      return;
    }

    if (!Number.isInteger(payload.port) || payload.port < 3003 || payload.port > 9999) {
      setProvisionError("Port must be between 3003 and 9999.");
      setRetryPayload(payload);
      return;
    }

    setProvisioning(true);
    setProvisionError("");
    setProvisionSuccess(null);
    setRetryPayload(payload);
    try {
      const res = await fetch("/api/restaurants/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const response = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(response?.error || response?.details || "Provisioning failed");
      }

      const restaurant = response?.restaurant as ProvisionResponse;
      if (!restaurant) throw new Error("Provisioning completed but response payload is missing.");

      setProvisionSuccess(restaurant);
      setRetryPayload(null);
      setShowProvisionForm(false);
      resetProvisionForm();
      showToast("Restaurant provisioned.", "success");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Provisioning failed";
      setProvisionError(message);
      showToast(message, "error");
    } finally {
      setProvisioning(false);
    }
  }

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
        {canManage ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShowProvisionForm((prev) => !prev);
                setProvisionError("");
              }}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-slate-700"
            >
              {showProvisionForm ? "Cancel" : "New Restaurant"}
            </button>
            <Link
              href="/dashboard/restaurants/new"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
            >
              Advanced Form
            </Link>
          </div>
        ) : null}
      </div>

      {provisionSuccess ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <div className="font-semibold">Restaurant provisioned successfully.</div>
          <div className="mt-1">URL: <a className="underline" href={provisionSuccess.url} target="_blank" rel="noreferrer">{provisionSuccess.url}</a></div>
          <div>Login: {provisionSuccess.ownerEmail} / <span className="font-mono">{provisionSuccess.password}</span></div>
          <div className="mt-1 text-xs text-emerald-800">License: {provisionSuccess.licenseKey}</div>
        </div>
      ) : null}

      {provisionError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <div className="font-semibold">Provisioning failed</div>
          <div className="mt-1">{provisionError}</div>
          <div className="mt-2">
            <button
              type="button"
              onClick={() => void provisionRestaurant(retryPayload || undefined)}
              disabled={provisioning}
              className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
            >
              {provisioning ? "Retrying..." : "Retry"}
            </button>
          </div>
        </div>
      ) : null}

      {showProvisionForm && canManage ? (
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Provision New Restaurant</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Restaurant Name</span>
              <input
                value={provisionName}
                onChange={(e) => setProvisionName(e.target.value)}
                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
                placeholder="The Reef"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Slug</span>
              <input
                value={provisionSlug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setProvisionSlug(e.target.value.toLowerCase());
                }}
                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
                placeholder="the-reef"
              />
              <span className="mt-1 block text-xs text-slate-500">Lowercase letters, numbers, and hyphens only.</span>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Owner Email</span>
              <input
                type="email"
                value={provisionOwnerEmail}
                onChange={(e) => setProvisionOwnerEmail(e.target.value)}
                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
                placeholder="owner@restaurant.com"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Plan</span>
              <select
                value={provisionPlan}
                onChange={(e) => setProvisionPlan(e.target.value as RestaurantPlan)}
                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
              >
                <option value="CORE">Core</option>
                <option value="SERVICE_PRO">Service Pro</option>
                <option value="FULL_SUITE">Full Suite</option>
              </select>
            </label>
            <label className="block md:max-w-xs">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Port</span>
              <input
                type="number"
                min={3003}
                max={9999}
                value={provisionPort}
                onChange={(e) => setProvisionPort(e.target.value)}
                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void provisionRestaurant()}
              disabled={provisioning}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {provisioning ? "Provisioning..." : "Provision Restaurant"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowProvisionForm(false);
                setProvisionError("");
              }}
              disabled={provisioning}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </section>
      ) : null}

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
