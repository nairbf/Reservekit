"use client";

import { useEffect, useMemo, useState } from "react";

type SessionUser = {
  id: string;
  email: string;
  name: string;
};

type Restaurant = {
  id: string;
  slug: string;
  name: string;
  plan: string;
  status: string;
  hosted: boolean;
  hostingStatus: string;
  licenseKey: string;
  licenseActivatedAt: string | null;
  licenseExpiry: string | null;
  monthlyHostingActive: boolean;
  ownerName: string | null;
  ownerEmail: string | null;
  domain: string | null;
  createdAt: string;
};

function planLabel(plan: string) {
  if (plan === "CORE") return "Core";
  if (plan === "SERVICE_PRO") return "Service Pro";
  if (plan === "FULL_SUITE") return "Full Suite";
  return plan;
}

function statusClass(status: string) {
  if (status === "ACTIVE") return "text-emerald-700";
  if (status === "TRIAL") return "text-amber-700";
  if (status === "SUSPENDED") return "text-rose-700";
  return "text-slate-700";
}

export function PortalDashboard() {
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPortalData() {
      try {
        const response = await fetch("/api/auth/me", {
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) return;

        const payload = (await response.json()) as {
          user?: SessionUser;
          restaurant?: Restaurant;
        };

        if (payload.user) setUser(payload.user);
        if (payload.restaurant) setRestaurant(payload.restaurant);
      } catch {
        // AuthGuard handles redirects if session is invalid.
      } finally {
        setLoading(false);
      }
    }

    loadPortalData();
    return () => controller.abort();
  }, []);

  const instanceHost = useMemo(() => {
    if (!restaurant) return "";
    return restaurant.domain || `${restaurant.slug}.reservesit.com`;
  }, [restaurant]);

  const instanceUrl = instanceHost ? `https://${instanceHost}` : "";
  const dashboardUrl = instanceUrl ? `${instanceUrl}/login` : "";

  const maskedLicense = useMemo(() => {
    const key = restaurant?.licenseKey || "";
    if (!key) return "N/A";
    if (key.length <= 12) return key;
    return `${key.slice(0, 8)}••••••••${key.slice(-6)}`;
  }, [restaurant?.licenseKey]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        Loading portal details...
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Customer Portal</h1>
        <p className="mt-2 text-sm text-slate-600">
          No restaurant found for your account. Contact
          {" "}
          <a href="mailto:support@reservesit.com" className="text-blue-700 underline">support@reservesit.com</a>
          {" "}
          and include your login email.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{restaurant.name}</h1>
          <p className="text-sm text-slate-600">Manage your ReserveSit license and instance.</p>
          {user?.email ? <p className="mt-1 text-xs text-slate-500">Portal login: {user.email}</p> : null}
        </div>
        {dashboardUrl ? (
          <a
            href={dashboardUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            Go to Dashboard →
          </a>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">License</h2>
          <p className="mt-2 font-mono text-sm text-slate-900">{revealed ? restaurant.licenseKey || "N/A" : maskedLicense}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold"
            >
              {revealed ? "Hide" : "Reveal"}
            </button>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(restaurant.licenseKey || "");
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold"
            >
              Copy
            </button>
          </div>
          <p className="mt-4 text-sm text-slate-700">
            Plan: <strong>{planLabel(restaurant.plan)}</strong>
          </p>
          <p className="text-sm text-slate-700">
            Status:{" "}
            <strong className={statusClass(restaurant.status)}>{restaurant.status}</strong>
          </p>
          {restaurant.licenseActivatedAt ? (
            <p className="text-sm text-slate-700">
              Activated: <strong>{new Date(restaurant.licenseActivatedAt).toLocaleDateString()}</strong>
            </p>
          ) : null}
          {restaurant.licenseExpiry ? (
            <p className="text-sm text-slate-700">
              Expires: <strong>{new Date(restaurant.licenseExpiry).toLocaleDateString()}</strong>
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Instance</h2>
          <p className="mt-2 text-sm text-slate-700">
            URL:{" "}
            <a className="font-semibold text-blue-700 underline" href={instanceUrl} target="_blank" rel="noreferrer">
              {instanceHost}
            </a>
          </p>
          {restaurant.domain && restaurant.domain !== `${restaurant.slug}.reservesit.com` ? (
            <p className="mt-1 text-sm text-slate-700">
              Custom Domain:{" "}
              <a className="font-semibold text-blue-700 underline" href={`https://${restaurant.domain}`} target="_blank" rel="noreferrer">
                {restaurant.domain}
              </a>
            </p>
          ) : null}
          <p className="mt-1 text-sm text-slate-700">Hosting: <strong>{restaurant.hosted ? "Managed" : "Self-Hosted"}</strong></p>
          <p className="mt-1 text-sm text-slate-700">
            Hosting Status: <strong className={statusClass(restaurant.hostingStatus)}>{restaurant.hostingStatus}</strong>
          </p>
          {restaurant.monthlyHostingActive ? (
            <p className="mt-1 text-sm text-slate-700">Billing: <strong>Monthly active</strong></p>
          ) : null}
          <p className="mt-3 text-sm text-slate-700">
            Support:{" "}
            <a className="text-blue-700 underline" href="mailto:support@reservesit.com">support@reservesit.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}
