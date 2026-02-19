"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

type DomainRequestType = "connect" | "register";

type User = {
  name: string;
  email: string;
};

type MePayload = {
  user?: User;
  restaurant?: {
    slug?: string | null;
    domain?: string | null;
  } | null;
  restaurantSlug?: string | null;
  restaurantUrl?: string | null;
};

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
  return slug || "your-restaurant";
}

function getPreferredType(interest: string | null): DomainRequestType | null {
  if (interest === "domain-connect") return "connect";
  if (interest === "domain-new") return "register";
  return null;
}

export default function DomainManagementPage() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [restaurantSlug, setRestaurantSlug] = useState<string | null>(null);
  const [restaurantUrl, setRestaurantUrl] = useState<string | null>(null);
  const [customDomain, setCustomDomain] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [connectDomain, setConnectDomain] = useState("");
  const [registerDomain, setRegisterDomain] = useState("");
  const [sendingType, setSendingType] = useState<DomainRequestType | null>(null);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/me", { signal: controller.signal });
        if (!response.ok) return;
        const payload = (await response.json()) as MePayload;

        if (payload.user?.email) {
          setUser(payload.user);
        }

        const apiSlug =
          (typeof payload.restaurantSlug === "string" && payload.restaurantSlug.trim()) ||
          (typeof payload.restaurant?.slug === "string" && payload.restaurant.slug.trim()) ||
          "";

        if (apiSlug) {
          setRestaurantSlug(apiSlug);
          setRestaurantUrl(
            (typeof payload.restaurantUrl === "string" && payload.restaurantUrl.trim()) ||
              `https://${apiSlug}.reservesit.com`,
          );
        }

        const domainValue =
          typeof payload.restaurant?.domain === "string" ? payload.restaurant.domain.trim() : "";
        setCustomDomain(domainValue || null);
      } catch {
        // Ignore; AuthGuard controls access.
      } finally {
        setLoadingUser(false);
      }
    }

    void loadSession();
    return () => controller.abort();
  }, []);

  const preferredType = getPreferredType(searchParams.get("interest"));

  const fallbackSlug = useMemo(() => {
    if (user?.name) return slugify(user.name);
    if (user?.email) return slugify(user.email.split("@")[0] || "");
    return "your-restaurant";
  }, [user]);

  const resolvedSlug = restaurantSlug || fallbackSlug;
  const resolvedSubdomainUrl = restaurantUrl || `https://${resolvedSlug}.reservesit.com`;

  async function submitRequest(type: DomainRequestType) {
    setMessage(null);

    const domain = (type === "connect" ? connectDomain : registerDomain).trim().toLowerCase();
    if (!domain) {
      setMessage({ kind: "error", text: "Please enter a domain before submitting." });
      return;
    }

    setSendingType(type);

    try {
      const response = await fetch("/api/domain-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          domain,
          restaurantSlug: resolvedSlug,
        }),
      });

      const payload = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not submit request.");
      }

      setMessage({
        kind: "success",
        text: payload.message || "We've received your request and will be in touch within 24 hours.",
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Could not submit request.";
      setMessage({ kind: "error", text: detail });
    } finally {
      setSendingType(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold text-slate-900">Domain & URL Management</h1>
      <p className="mt-2 text-sm text-slate-600">
        Keep your included ReserveSit URL or request a custom domain setup.
      </p>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Your Current URL</h2>
        <div className="mt-4 space-y-3 text-sm text-slate-700">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-base">🌐</span>
            <span className="font-semibold">{resolvedSlug}.reservesit.com</span>
            <a
              href={resolvedSubdomainUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700"
            >
              Visit Site
            </a>
          </div>
          <p>Status: <span className="font-semibold text-emerald-700">Active</span></p>
          <p>SSL: <span className="font-semibold text-emerald-700">Secured</span></p>
          {customDomain ? (
            <p>
              Custom Domain:{" "}
              <a
                href={`https://${customDomain}`}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-blue-700 underline"
              >
                {customDomain}
              </a>
            </p>
          ) : (
            <p>Custom Domain: <span className="font-medium text-slate-500">Not configured</span></p>
          )}
          {loadingUser ? <p className="text-xs text-slate-400">Loading account details…</p> : null}
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Get Your Own Domain</h2>
        <p className="mt-2 text-sm text-slate-600">
          Already have a domain or need us to register one? Submit a request and we will handle the setup.
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div
            className={`rounded-xl border p-4 ${
              preferredType === "connect" ? "border-blue-400 bg-blue-50" : "border-slate-200"
            }`}
          >
            <h3 className="text-lg font-semibold text-slate-900">Connect Existing Domain</h3>
            <p className="mt-1 text-sm text-slate-600">$30 one-time setup fee. We configure DNS + SSL.</p>
            <label className="mt-4 block text-sm font-medium text-slate-700">Domain</label>
            <input
              type="text"
              value={connectDomain}
              onChange={(event) => setConnectDomain(event.target.value)}
              placeholder="reservations.myrestaurant.com"
              className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
            />
            <p className="mt-1 text-xs text-slate-500">Example: reservations.myrestaurant.com</p>
            <button
              type="button"
              onClick={() => void submitRequest("connect")}
              disabled={sendingType !== null}
              className="mt-4 h-11 w-full rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {sendingType === "connect" ? "Submitting..." : "Request Setup - $30"}
            </button>
          </div>

          <div
            className={`rounded-xl border p-4 ${
              preferredType === "register" ? "border-blue-400 bg-blue-50" : "border-slate-200"
            }`}
          >
            <h3 className="text-lg font-semibold text-slate-900">Register New Domain</h3>
            <p className="mt-1 text-sm text-slate-600">$99 one-time (typically includes 2-3 year registration).</p>
            <label className="mt-4 block text-sm font-medium text-slate-700">Desired domain</label>
            <input
              type="text"
              value={registerDomain}
              onChange={(event) => setRegisterDomain(event.target.value)}
              placeholder="myrestaurant.com"
              className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
            />
            <p className="mt-1 text-xs text-slate-500">Example: myrestaurant.com</p>
            <button
              type="button"
              onClick={() => void submitRequest("register")}
              disabled={sendingType !== null}
              className="mt-4 h-11 w-full rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {sendingType === "register" ? "Submitting..." : "Check Availability & Request - $99"}
            </button>
          </div>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Domain registration prices may vary depending on domain name and availability. We will confirm pricing before purchase.
        </p>

        {message ? (
          <div className={`mt-4 rounded-lg px-3 py-2 text-sm ${message.kind === "success" ? "border border-emerald-200 bg-emerald-50 text-emerald-800" : "border border-red-200 bg-red-50 text-red-700"}`}>
            {message.text}
          </div>
        ) : null}
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Domain FAQ</h2>
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">How long does setup take?</p>
            <p className="mt-1 text-sm text-slate-700">Connecting an existing domain is usually done within 24 hours. New domain registration usually takes up to 48 hours.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">What do I need to do?</p>
            <p className="mt-1 text-sm text-slate-700">For existing domains, you may need to add a CNAME record using instructions we provide. For new registrations, we handle everything.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Can I change my domain later?</p>
            <p className="mt-1 text-sm text-slate-700">Yes. Contact <a href="mailto:support@reservesit.com" className="text-blue-700 underline">support@reservesit.com</a> and we can help with changes.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Will my reservesit.com URL still work?</p>
            <p className="mt-1 text-sm text-slate-700">Yes. Your reserve URL can continue working alongside your custom domain.</p>
          </div>
        </div>
      </section>

      <div className="mt-8">
        <Link href="/portal" className="text-sm font-medium text-blue-700 underline">
          ← Back to portal
        </Link>
      </div>
    </div>
  );
}
