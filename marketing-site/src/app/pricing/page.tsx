"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type PlanKey = "core" | "servicePro" | "fullSuite";
type AddonKey = "sms" | "floorPlan" | "reporting" | "guestHistory" | "eventTicketing";
type HostingKey = "none" | "monthly" | "annual";

const plans: Array<{
  key: PlanKey;
  name: string;
  price: number;
  blurb: string;
  featured?: boolean;
  features: string[];
}> = [
  {
    key: "core",
    name: "Core",
    price: 1799,
    blurb: "Reliable reservation operations without subscription lock-in.",
    features: [
      "Booking widget",
      "Hostess dashboard",
      "Tables + approvals",
      "Email notifications",
      "Walk-ins + phone bookings",
      "14-day free trial",
    ],
  },
  {
    key: "servicePro",
    name: "Service Pro",
    price: 2227,
    blurb: "The best fit for active dining rooms that need faster service flow.",
    featured: true,
    features: [
      "Everything in Core",
      "SMS notifications",
      "Visual floor plan",
      "Reporting dashboard",
      "Priority setup support",
      "14-day free trial",
    ],
  },
  {
    key: "fullSuite",
    name: "Full Suite",
    price: 2734,
    blurb: "Complete toolkit for high-volume operations and special events.",
    features: [
      "Everything in Service Pro",
      "Guest history + notes",
      "Event ticketing",
      "Advanced customization",
      "Best for high-volume service",
      "14-day free trial",
    ],
  },
];

const addons: Array<{ key: AddonKey; name: string; price: number; description: string }> = [
  { key: "sms", name: "SMS Notifications", price: 199, description: "Text confirmations and reminders to reduce no-shows." },
  { key: "floorPlan", name: "Visual Floor Plan", price: 249, description: "Interactive table map with live status." },
  { key: "reporting", name: "Reporting Dashboard", price: 179, description: "Covers, no-show trends, and service metrics." },
  { key: "guestHistory", name: "Guest History", price: 179, description: "Repeat-guest context, notes, and preferences." },
  { key: "eventTicketing", name: "Event Ticketing", price: 129, description: "Sell and manage paid events and special seatings." },
];

const hosting = {
  none: { key: "none" as HostingKey, name: "Self-Hosted", price: 0, interval: "month", summary: "You handle hosting. We provide the code." },
  monthly: { key: "monthly" as HostingKey, name: "Managed Hosting", price: 15, interval: "month", summary: "We handle updates, backups, and monitoring." },
  annual: { key: "annual" as HostingKey, name: "Managed Hosting", price: 149, interval: "year", summary: "Annual managed hosting (save $31 per year)." },
};

const faq = [
  {
    q: "What happens after I purchase?",
    a: "You receive confirmation immediately. We provision your restaurant instance and onboarding details within 24 hours.",
  },
  {
    q: "Can I upgrade later?",
    a: "Yes. You can upgrade your plan at any time and pay only the price difference.",
  },
  {
    q: "What's included in the free trial?",
    a: "All new restaurants include a 14-day trial period for managed hosting so your team can validate the workflow before billing starts.",
  },
  {
    q: "Do I own the software?",
    a: "Yes. Your license is a one-time purchase. You can self-host and keep full control over your data.",
  },
  {
    q: "What if I want to cancel hosting?",
    a: "You can cancel managed hosting and migrate to self-hosting. We provide your data export and transition support.",
  },
];

function usd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function PricingPage() {
  const [plan, setPlan] = useState<PlanKey>("servicePro");
  const [selectedAddons, setSelectedAddons] = useState<AddonKey[]>([]);
  const [hostingCycle, setHostingCycle] = useState<"monthly" | "annual">("monthly");
  const [useManagedHosting, setUseManagedHosting] = useState(true);
  const [authState, setAuthState] = useState<"loading" | "authed" | "guest">("loading");
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [restaurantName, setRestaurantName] = useState("");

  const selectedPlan = useMemo(() => plans.find((item) => item.key === plan) || plans[0], [plan]);
  const selectedAddonRows = useMemo(() => addons.filter((item) => selectedAddons.includes(item.key)), [selectedAddons]);
  const selectedHosting = useMemo(() => {
    if (!useManagedHosting) return hosting.none;
    return hosting[hostingCycle];
  }, [useManagedHosting, hostingCycle]);

  const oneTimeTotal = useMemo(() => {
    const addonsTotal = selectedAddonRows.reduce((sum, item) => sum + item.price, 0);
    return selectedPlan.price + addonsTotal;
  }, [selectedPlan, selectedAddonRows]);

  const recurringLabel = useMemo(() => {
    if (!useManagedHosting) return "No recurring hosting fee";
    return hostingCycle === "monthly" ? "$15/month after 14-day trial" : "$149/year after 14-day trial";
  }, [useManagedHosting, hostingCycle]);

  useEffect(() => {
    let mounted = true;
    fetch("/api/auth/me")
      .then((response) => {
        if (!mounted) return;
        setAuthState(response.ok ? "authed" : "guest");
      })
      .catch(() => {
        if (!mounted) return;
        setAuthState("guest");
      });
    return () => {
      mounted = false;
    };
  }, []);

  function domainCtaHref(interest: "domain-connect" | "domain-new") {
    if (authState === "authed") return `/portal/domain?interest=${interest}`;
    return `/demo?interest=${interest}`;
  }

  function toggleAddon(key: AddonKey) {
    setSelectedAddons((prev) => {
      if (prev.includes(key)) return prev.filter((item) => item !== key);
      return [...prev, key];
    });
  }

  async function submitCheckout(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setCheckoutError("");

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          addons: selectedAddons,
          hosting: useManagedHosting ? hostingCycle : "none",
          customerEmail,
          customerName,
          restaurantName,
        }),
      });

      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) {
        throw new Error(payload.error || "Could not start checkout");
      }

      window.location.href = payload.url;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start checkout";
      setCheckoutError(message);
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_28%,#ffffff_68%)]">
      <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-blue-100 bg-white/90 p-8 shadow-[0_24px_70px_-35px_rgba(37,99,235,0.35)] sm:p-12">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">ReserveSit Pricing</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Own your reservation system.
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-slate-700">
            No per-cover tax. No platform lock-in. One-time license plus optional managed hosting.
          </p>

          <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 sm:p-5">
            <p className="font-semibold">OpenTable can run $3,000–$7,500/month for busy restaurants. ReserveSit charges once.</p>
            <p className="mt-1 text-rose-800">Keep your margins and keep ownership of your guest data.</p>
          </div>
        </section>

        <section className="mt-10 grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="space-y-8">
            <section>
              <h2 className="text-2xl font-semibold text-slate-900">Choose a Plan</h2>
              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                {plans.map((item) => {
                  const active = item.key === plan;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setPlan(item.key)}
                      className={`group rounded-2xl border p-5 text-left transition-all ${
                        active
                          ? "border-blue-500 bg-blue-50 shadow-md shadow-blue-100"
                          : "border-slate-200 bg-white hover:border-blue-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-lg font-semibold text-slate-900">{item.name}</h3>
                        {item.featured ? (
                          <span className="rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white">Most Popular</span>
                        ) : null}
                      </div>
                      <p className="mt-3 text-3xl font-bold text-slate-900">{usd(item.price)}</p>
                      <p className="text-xs uppercase tracking-wide text-slate-500">one-time license</p>
                      <p className="mt-3 text-sm text-slate-600">{item.blurb}</p>
                      <ul className="mt-4 space-y-1.5 text-sm text-slate-700">
                        {item.features.map((feature) => (
                          <li key={feature}>• {feature}</li>
                        ))}
                      </ul>
                      <span className={`mt-5 inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold ${active ? "bg-blue-600 text-white" : "border border-slate-300 text-slate-700"}`}>
                        {active ? "Selected" : "Get Started"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-xl font-semibold text-slate-900">Add-on Builder</h2>
              <p className="mt-1 text-sm text-slate-600">Start with any plan and add exactly what you need.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {addons.map((addon) => {
                  const checked = selectedAddons.includes(addon.key);
                  return (
                    <label
                      key={addon.key}
                      className={`cursor-pointer rounded-xl border p-4 transition-all ${checked ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-slate-50"}`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAddon(addon.key)}
                          className="mt-1 h-4 w-4 rounded border-slate-300"
                        />
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{addon.name}</p>
                          <p className="text-sm font-semibold text-blue-700">{usd(addon.price)}</p>
                          <p className="mt-1 text-xs text-slate-600">{addon.description}</p>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-xl font-semibold text-slate-900">Hosting Options</h2>
              <p className="mt-1 text-sm text-slate-600">Choose self-hosted or let us manage everything for you.</p>

              <div className="mt-4 inline-flex rounded-lg border border-slate-300 bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setHostingCycle("monthly")}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${hostingCycle === "monthly" ? "bg-white text-slate-900 shadow" : "text-slate-600"}`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setHostingCycle("annual")}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${hostingCycle === "annual" ? "bg-white text-slate-900 shadow" : "text-slate-600"}`}
                >
                  Annual
                </button>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setUseManagedHosting(false)}
                  className={`rounded-xl border p-4 text-left transition-all ${!useManagedHosting ? "border-blue-400 bg-blue-50" : "border-slate-200"}`}
                >
                  <p className="text-sm font-semibold text-slate-900">Self-Hosted</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">$0/month</p>
                  <p className="mt-1 text-xs text-slate-600">You handle hosting. We provide the code.</p>
                </button>

                <button
                  type="button"
                  onClick={() => setUseManagedHosting(true)}
                  className={`rounded-xl border p-4 text-left transition-all ${useManagedHosting ? "border-blue-400 bg-blue-50" : "border-slate-200"}`}
                >
                  <p className="text-sm font-semibold text-slate-900">Managed Hosting</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">
                    {hostingCycle === "monthly" ? "$15/month" : "$149/year"}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {hostingCycle === "annual" ? "Save $31 per year." : "Zero maintenance for your team."}
                  </p>
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-2xl font-semibold text-slate-900">Your Online Presence</h2>
              <p className="mt-2 text-sm text-slate-600">
                Every plan includes a free branded booking page at yourname.reservesit.com. Want your own domain? We&apos;ll handle everything.
              </p>

              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Free</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">Included with all plans</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">yourname.reservesit.com</p>
                  <ul className="mt-4 space-y-1.5 text-sm text-slate-700">
                    <li>✓ SSL included</li>
                    <li>✓ Mobile optimized</li>
                    <li>✓ Instant setup</li>
                  </ul>
                  <span className="mt-5 inline-flex h-10 items-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700">
                    Current Plan
                  </span>
                </div>

                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Connect Your Domain</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">$30 one-time</p>
                  <p className="mt-2 text-sm text-slate-700">Already have a domain? We configure DNS and SSL in about 24 hours.</p>
                  <ul className="mt-4 space-y-1.5 text-sm text-slate-700">
                    <li>✓ DNS configuration</li>
                    <li>✓ SSL certificate</li>
                    <li>✓ Done in 24 hours</li>
                  </ul>
                  <Link
                    href={domainCtaHref("domain-connect")}
                    className="mt-5 inline-flex h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white"
                  >
                    Get Started →
                  </Link>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">New Domain</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">$99 one-time</p>
                  <p className="mt-2 text-sm text-slate-700">Don&apos;t have a domain? We register and configure a new one for your restaurant.</p>
                  <ul className="mt-4 space-y-1.5 text-sm text-slate-700">
                    <li>✓ 2-3 year registration</li>
                    <li>✓ Full DNS setup</li>
                    <li>✓ SSL certificate</li>
                    <li>✓ Done in 48 hours</li>
                  </ul>
                  <Link
                    href={domainCtaHref("domain-new")}
                    className="mt-5 inline-flex h-10 items-center rounded-lg bg-amber-600 px-4 text-sm font-semibold text-white"
                  >
                    Get Started →
                  </Link>
                </div>
              </div>

              <p className="mt-4 text-xs text-slate-500">
                Domain registration prices may vary depending on domain name and availability. The $99 price covers most standard .com domains.
                Premium or specialty domains may cost more and are always confirmed before purchase.
              </p>
            </section>
          </div>

          <aside className="xl:sticky xl:top-24 xl:self-start">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">Order Summary</h2>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-700">{selectedPlan.name} License</span>
                  <span className="font-semibold text-slate-900">{usd(selectedPlan.price)}</span>
                </div>

                {selectedAddonRows.map((addon) => (
                  <div key={addon.key} className="flex items-start justify-between gap-3">
                    <span className="text-slate-700">{addon.name}</span>
                    <span className="font-semibold text-slate-900">{usd(addon.price)}</span>
                  </div>
                ))}

                <div className="border-t border-slate-200 pt-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium text-slate-800">One-time total</span>
                    <span className="text-lg font-bold text-slate-900">{usd(oneTimeTotal)}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Due at checkout</p>
                </div>

                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Hosting</p>
                  <p className="mt-1 font-medium text-slate-800">{selectedHosting.name}</p>
                  <p className="text-xs text-slate-600">{selectedHosting.summary}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{recurringLabel}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setCheckoutError("");
                  setShowCheckoutModal(true);
                }}
                className="mt-5 h-11 w-full rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-all hover:bg-blue-700"
              >
                Proceed to Checkout
              </button>

              <p className="mt-3 text-xs text-slate-500">
                Stripe Checkout handles payment security. We never store card numbers.
              </p>
            </div>
          </aside>
        </section>

        <section className="mt-12 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-2xl font-semibold text-slate-900">Pricing FAQ</h2>
          <div className="mt-5 space-y-3">
            {faq.map((item) => (
              <div key={item.q} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-900">{item.q}</h3>
                <p className="mt-1 text-sm text-slate-700">{item.a}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {showCheckoutModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Complete your checkout</h3>
                <p className="mt-1 text-sm text-slate-600">We'll use this info for license provisioning and onboarding.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCheckoutModal(false)}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs"
              >
                Close
              </button>
            </div>

            <form onSubmit={submitCheckout} className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Your name</span>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
                  placeholder="Alex Rivera"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Email</span>
                <input
                  type="email"
                  required
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
                  placeholder="owner@restaurant.com"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Restaurant name</span>
                <input
                  type="text"
                  required
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
                  placeholder="The Reef"
                />
              </label>

              {checkoutError ? <p className="text-sm text-red-600">{checkoutError}</p> : null}

              <button
                type="submit"
                disabled={submitting}
                className="h-11 w-full rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {submitting ? "Redirecting to Stripe..." : "Continue to Stripe Checkout"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
