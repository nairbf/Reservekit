"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/toast-provider";

type ExistingRestaurant = {
  port: number;
};

const ADDON_OPTIONS = [
  { key: "addonSms", label: "SMS Notifications", price: "$199" },
  { key: "addonFloorPlan", label: "Visual Floor Plan", price: "$249" },
  { key: "addonReporting", label: "Reporting Dashboard", price: "$179" },
  { key: "addonGuestHistory", label: "Guest History", price: "$179" },
  { key: "addonEventTicketing", label: "Event Ticketing", price: "$129" },
] as const;

const TIMEZONE_OPTIONS = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Phoenix",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
] as const;

type AddonKey = (typeof ADDON_OPTIONS)[number]["key"];

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function applyPlanIncludes(plan: string, current: Record<AddonKey, boolean>) {
  const next = { ...current };

  if (plan === "SERVICE_PRO") {
    next.addonSms = true;
    next.addonFloorPlan = true;
    next.addonReporting = true;
  }

  if (plan === "FULL_SUITE") {
    next.addonSms = true;
    next.addonFloorPlan = true;
    next.addonReporting = true;
    next.addonGuestHistory = true;
    next.addonEventTicketing = true;
  }

  return next;
}

export default function NewRestaurantPage() {
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [slugInput, setSlugInput] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [restaurantPhone, setRestaurantPhone] = useState("");
  const [restaurantAddress, setRestaurantAddress] = useState("");
  const [notificationEmail, setNotificationEmail] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [initialPassword, setInitialPassword] = useState("");
  const [plan, setPlan] = useState("CORE");
  const [status, setStatus] = useState("TRIAL");
  const [port, setPort] = useState("");
  const [hosted, setHosted] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [provisioningCommand, setProvisioningCommand] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [seededRestaurantDb, setSeededRestaurantDb] = useState(false);
  const [adminUserCreated, setAdminUserCreated] = useState(false);
  const [seedSkipped, setSeedSkipped] = useState(false);
  const [seedError, setSeedError] = useState("");

  const [addons, setAddons] = useState<Record<AddonKey, boolean>>({
    addonSms: false,
    addonFloorPlan: false,
    addonReporting: false,
    addonGuestHistory: false,
    addonEventTicketing: false,
  });

  const slug = useMemo(() => slugify(slugInput || name), [slugInput, name]);

  useEffect(() => {
    async function loadPort() {
      try {
        const res = await fetch("/api/restaurants", { cache: "no-store" });
        if (!res.ok) return;
        const rows = (await res.json()) as ExistingRestaurant[];
        const maxPort = rows.reduce((max, row) => Math.max(max, Number(row.port || 0)), 3000);
        setPort(String(maxPort + 1));
      } catch {
        // optional helper; fallback remains empty
      }
    }

    void loadPort();
  }, []);

  useEffect(() => {
    if (!notificationEmail.trim()) {
      setNotificationEmail(ownerEmail.trim().toLowerCase());
    }
  }, [ownerEmail, notificationEmail]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setProvisioningCommand("");
    setLicenseKey("");
    setSeededRestaurantDb(false);
    setAdminUserCreated(false);
    setSeedSkipped(false);
    setSeedError("");

    try {
      const normalizedAddons = applyPlanIncludes(plan, addons);
      const res = await fetch("/api/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          adminEmail: ownerEmail,
          ownerName,
          ownerEmail,
          ownerPhone,
          notificationEmail,
          timezone,
          phone: restaurantPhone,
          address: restaurantAddress,
          initialPassword,
          domain: slug ? `${slug}.reservesit.com` : undefined,
          plan,
          status,
          hosted,
          hostingStatus: hosted ? "ACTIVE" : "SELF_HOSTED",
          monthlyHostingActive: hosted,
          port: port ? Number(port) : undefined,
          ...normalizedAddons,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to create restaurant");

      setProvisioningCommand(payload?.provisioningCommand || "");
      setLicenseKey(payload?.restaurant?.licenseKey || "");
      setSeededRestaurantDb(Boolean(payload?.seededRestaurantDb));
      setAdminUserCreated(Boolean(payload?.adminUserCreated));
      setSeedSkipped(Boolean(payload?.seedSkipped));
      setSeedError(String(payload?.seedError || ""));
      showToast("Restaurant created.", "success");

      setName("");
      setSlugInput("");
      setOwnerName("");
      setOwnerEmail("");
      setOwnerPhone("");
      setRestaurantPhone("");
      setRestaurantAddress("");
      setNotificationEmail("");
      setTimezone("America/New_York");
      setInitialPassword("");
      setPlan("CORE");
      setStatus("TRIAL");
      setHosted(true);
      setAddons({
        addonSms: false,
        addonFloorPlan: false,
        addonReporting: false,
        addonGuestHistory: false,
        addonEventTicketing: false,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create restaurant");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Provision New Restaurant</h1>
          <p className="text-sm text-slate-600">Create a customer account, assign plan/add-ons, and generate a license key.</p>
        </div>
        <Link href="/dashboard/restaurants" className="text-sm font-medium text-slate-700 underline">
          Back to restaurants
        </Link>
      </div>

      <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Restaurant Basics</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Restaurant Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} required className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Slug</span>
              <input value={slugInput} onChange={(e) => setSlugInput(e.target.value)} placeholder="reef" className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" />
              <span className="mt-1 block text-xs text-slate-500">Final slug: {slug || "-"}</span>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Owner Name</span>
              <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Owner Email</span>
              <input value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} type="email" required className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Owner Phone</span>
              <input value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Initial Admin Password</span>
              <input
                value={initialPassword}
                onChange={(e) => setInitialPassword(e.target.value)}
                type="password"
                required
                minLength={8}
                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
              <span className="mt-1 block text-xs text-slate-500">Used for the first admin account in the restaurant instance.</span>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Port</span>
              <input value={port} onChange={(e) => setPort(e.target.value)} type="number" min={3001} className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" />
            </label>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Initial Setup</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Restaurant Phone</span>
              <input
                value={restaurantPhone}
                onChange={(e) => setRestaurantPhone(e.target.value)}
                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Notification Email</span>
              <input
                value={notificationEmail}
                onChange={(e) => setNotificationEmail(e.target.value)}
                type="email"
                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
              <span className="mt-1 block text-xs text-slate-500">Reservation alerts and reply-to default.</span>
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-700">Restaurant Address</span>
              <input
                value={restaurantAddress}
                onChange={(e) => setRestaurantAddress(e.target.value)}
                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Timezone</span>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
              >
                {TIMEZONE_OPTIONS.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Plan & Hosting</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Plan</span>
              <select
                value={plan}
                onChange={(e) => {
                  const nextPlan = e.target.value;
                  setPlan(nextPlan);
                  setAddons((prev) => applyPlanIncludes(nextPlan, prev));
                }}
                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
              >
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
              <input type="checkbox" checked={hosted} onChange={(e) => setHosted(e.target.checked)} />
              Hosted by ReserveSit ($15/mo)
            </label>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Add-ons</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {ADDON_OPTIONS.map((option) => (
              <label key={option.key} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                <span>
                  <span className="block text-sm font-medium text-slate-900">{option.label}</span>
                  <span className="text-xs text-slate-500">{option.price}</span>
                </span>
                <input
                  type="checkbox"
                  checked={addons[option.key]}
                  onChange={(e) => setAddons((prev) => ({ ...prev, [option.key]: e.target.checked }))}
                />
              </label>
            ))}
          </div>
        </section>

        {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div> : null}

        <button
          type="submit"
          disabled={loading}
          className="h-11 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition-all duration-200 hover:bg-slate-700 disabled:opacity-60"
        >
          {loading ? "Creating..." : "Create Restaurant"}
        </button>
      </form>

      {provisioningCommand ? (
        <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">Restaurant created successfully.</p>
          {licenseKey ? (
            <p>
              License key: <span className="font-mono text-xs">{licenseKey}</span>
            </p>
          ) : null}
          <p>Run this provisioning command on the host server:</p>
          <code className="block overflow-x-auto rounded-lg bg-white p-3 text-xs text-slate-900">
            {provisioningCommand}
          </code>
          <button
            type="button"
            className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold"
            onClick={async () => {
              await navigator.clipboard.writeText(provisioningCommand);
              showToast("Provisioning command copied.", "success");
            }}
          >
            Copy Command
          </button>
          <div className="space-y-1 text-xs text-emerald-900">
            <div>Settings seeded to restaurant DB: {seededRestaurantDb ? "Yes" : "No"}</div>
            <div>Admin user created in restaurant DB: {adminUserCreated ? "Yes" : "No"}</div>
            {seedSkipped ? <div>Restaurant DB not found yet. Settings/user setup will happen after provisioning.</div> : null}
            {seedError ? <div className="text-rose-700">Setup warning: {seedError}</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
