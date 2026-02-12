"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/toast-provider";

export default function NewRestaurantPage() {
  const { showToast } = useToast();
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [plan, setPlan] = useState("CORE");
  const [status, setStatus] = useState("TRIAL");
  const [monthlyHostingActive, setMonthlyHostingActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [provisioningCommand, setProvisioningCommand] = useState("");

  const slugHint = useMemo(
    () =>
      slug
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-"),
    [slug],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setProvisioningCommand("");

    try {
      const res = await fetch("/api/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: slugHint,
          name,
          adminEmail,
          plan,
          status,
          monthlyHostingActive,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to create restaurant");

      setProvisioningCommand(payload?.provisioningCommand || "");
      showToast("Restaurant created.", "success");
      setSlug("");
      setName("");
      setAdminEmail("");
      setPlan("CORE");
      setStatus("TRIAL");
      setMonthlyHostingActive(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create restaurant");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Add Restaurant</h1>
          <p className="text-sm text-slate-600">Create a new customer record and generate license credentials.</p>
        </div>
        <Link href="/dashboard/restaurants" className="text-sm font-medium text-slate-700 underline">
          Back to restaurants
        </Link>
      </div>

      <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Restaurant Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Admin Email</span>
            <input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} type="email" required className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Slug</span>
            <input value={slug} onChange={(e) => setSlug(e.target.value)} required className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" />
            <span className="mt-1 block text-xs text-slate-500">Will save as: {slugHint || "-"}</span>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Plan</span>
            <select value={plan} onChange={(e) => setPlan(e.target.value)} className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm">
              <option value="CORE">CORE</option>
              <option value="SERVICE_PRO">SERVICE PRO</option>
              <option value="FULL_SUITE">FULL SUITE</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm">
              <option value="TRIAL">TRIAL</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </label>

          <label className="flex items-center gap-2 pt-7 text-sm text-slate-700">
            <input type="checkbox" checked={monthlyHostingActive} onChange={(e) => setMonthlyHostingActive(e.target.checked)} />
            Monthly Hosting Active ($15/mo)
          </label>
        </div>

        {error ? <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div> : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-5 h-11 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition-all duration-200 hover:bg-slate-700 disabled:opacity-60"
        >
          {loading ? "Creating..." : "Create Restaurant"}
        </button>
      </form>

      {provisioningCommand ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">Restaurant created successfully.</p>
          <p className="mt-2">Run this provisioning command on the host server:</p>
          <code className="mt-2 block overflow-x-auto rounded-lg bg-white p-3 text-xs text-slate-900">
            {provisioningCommand}
          </code>
          <button
            type="button"
            className="mt-3 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold"
            onClick={async () => {
              await navigator.clipboard.writeText(provisioningCommand);
              showToast("Provisioning command copied.", "success");
            }}
          >
            Copy Command
          </button>
        </div>
      ) : null}
    </div>
  );
}
