"use client";

import { useMemo, useState } from "react";

type PlanKey = "core" | "servicePro" | "fullSuite";
type AddonKey = "sms" | "floorPlan" | "reporting" | "guestHistory" | "eventTicketing" | "customDomain";

const plans: Array<{
  key: PlanKey;
  name: string;
  price: number;
  hostingPrice: number;
  blurb: string;
  featured?: boolean;
  features: string[];
}> = [
  {
    key: "core",
    name: "Core",
    price: 2199,
    hostingPrice: 299,
    blurb: "Everything you need to run reservations - without subscription lock-in.",
    features: [
      "Reservation booking widget",
      "Host dashboard & tonight view",
      "Waitlist management",
      "Email confirmations & reminders",
      "Guest database",
      "Schedule management",
      "Landing page builder",
      "POS integrations (SpotOn, Square, Toast, Clover)",
      "First year managed hosting included",
    ],
  },
  {
    key: "servicePro",
    name: "Service Pro",
    price: 2999,
    hostingPrice: 399,
    blurb: "For busy dining rooms that need real-time floor management and faster communication.",
    featured: true,
    features: [
      "Everything in Core",
      "SMS notifications",
      "Interactive floor plan",
      "Reporting dashboard",
      "Menu display",
      "Priority setup support",
      "First year managed hosting included",
    ],
  },
  {
    key: "fullSuite",
    name: "Full Suite",
    price: 3799,
    hostingPrice: 399,
    blurb: "Complete toolkit for high-volume operations, events, and repeat-guest loyalty.",
    features: [
      "Everything in Service Pro",
      "Event ticketing",
      "Full guest history & loyalty",
      "Pre-ordering",
      "Advanced customization",
      "Priority support",
      "First year managed hosting included",
    ],
  },
];

const addons: Array<{ key: AddonKey; name: string; price: number; description: string }> = [
  { key: "sms", name: "SMS Notifications", price: 349, description: "Text confirmations and reminders to cut no-shows." },
  { key: "floorPlan", name: "Visual Floor Plan", price: 399, description: "Interactive table map with live status." },
  { key: "reporting", name: "Reporting Dashboard", price: 299, description: "Covers, no-show trends, and service metrics." },
  { key: "guestHistory", name: "Guest History & Loyalty", price: 349, description: "Repeat-guest context, notes, and preferences." },
  { key: "eventTicketing", name: "Event Ticketing", price: 299, description: "Sell and manage paid events and special seatings." },
  { key: "customDomain", name: "Custom Domain Setup", price: 30, description: "Connect your own domain to your ReserveSit instance." },
];

const PLAN_INCLUDED_ADDONS: Record<PlanKey, AddonKey[]> = {
  core: [],
  servicePro: ["sms", "floorPlan", "reporting"],
  fullSuite: ["sms", "floorPlan", "reporting", "guestHistory", "eventTicketing"],
};

const faq = [
  {
    q: "What's included in managed hosting?",
    a: "Dedicated cloud server, daily automated backups, software updates & security patches, uptime monitoring, and email/chat support. First year is included free.",
  },
  {
    q: "What if I don't renew hosting?",
    a: "Your instance stays live but won't receive updates, backups, or support. You can self-host at any time or renew later.",
  },
  {
    q: "Is there a monthly option?",
    a: "We offer one-time licensing to save you money long-term. The only recurring cost is annual managed hosting starting year 2.",
  },
  {
    q: "Can I self-host?",
    a: "Yes. The software is yours. You can run it on your own infrastructure - no hosting fee required.",
  },
  {
    q: "Can I upgrade later?",
    a: "Yes. You can upgrade your plan at any time and only pay the difference in one-time license cost.",
  },
];

const savingsRows = [
  { label: "ReserveSit Core", year1: "$2,199", year2: "$299", year3: "$299", total: "$2,797", reserveSit: true },
  { label: "ReserveSit Pro", year1: "$2,999", year2: "$399", year3: "$399", total: "$3,797", reserveSit: true },
  { label: "ReserveSit Full", year1: "$3,799", year2: "$399", year3: "$399", total: "$4,597", reserveSit: true },
  { label: "OpenTable", year1: "$6,000+", year2: "$6,000+", year3: "$6,000+", total: "$18,000+", reserveSit: false },
  { label: "Resy", year1: "$5,988+", year2: "$5,988+", year3: "$5,988+", total: "$17,964+", reserveSit: false },
];

function usd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function PricingPageClient() {
  const [plan, setPlan] = useState<PlanKey>("servicePro");
  const [selectedAddons, setSelectedAddons] = useState<AddonKey[]>([]);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [restaurantName, setRestaurantName] = useState("");

  const selectedPlan = useMemo(() => plans.find((item) => item.key === plan) || plans[0], [plan]);
  const includedAddonKeys = useMemo(() => new Set<AddonKey>(PLAN_INCLUDED_ADDONS[plan]), [plan]);

  const billableSelectedAddons = useMemo(
    () => selectedAddons.filter((addon) => !includedAddonKeys.has(addon)),
    [includedAddonKeys, selectedAddons],
  );

  const selectedAddonRows = useMemo(
    () => addons.filter((item) => billableSelectedAddons.includes(item.key)),
    [billableSelectedAddons],
  );

  const includedAddonRows = useMemo(
    () => addons.filter((item) => includedAddonKeys.has(item.key)),
    [includedAddonKeys],
  );

  const oneTimeTotal = useMemo(() => {
    const addonsTotal = selectedAddonRows.reduce((sum, item) => sum + item.price, 0);
    return selectedPlan.price + addonsTotal;
  }, [selectedPlan, selectedAddonRows]);

  function toggleAddon(key: AddonKey) {
    setSelectedAddons((prev) => {
      if (includedAddonKeys.has(key)) return prev;
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
          addons: billableSelectedAddons,
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
            One-time license. First year managed hosting included. Renew annually starting year 2.
          </p>

          <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 sm:p-5">
            <p className="font-semibold">OpenTable can run $3,000-$7,000/year for busy restaurants. ReserveSit charges once.</p>
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
                      <p className="mt-1 text-sm font-semibold text-slate-700">
                        + {usd(item.hostingPrice)}/yr managed hosting (first year included)
                      </p>
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
              <p className="mt-1 text-sm text-slate-600">
                Core users can add features individually. Service Pro and Full Suite include select add-ons automatically.
              </p>
              {plan === "fullSuite" ? (
                <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  All core add-ons are included in Full Suite. Custom Domain Setup remains optional.
                </p>
              ) : null}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {addons.map((addon) => {
                  const includedByPlan = includedAddonKeys.has(addon.key);
                  const checked = includedByPlan || billableSelectedAddons.includes(addon.key);
                  return (
                    <label
                      key={addon.key}
                      className={`rounded-xl border p-4 transition-all ${
                        includedByPlan
                          ? "border-slate-300 bg-slate-100"
                          : checked
                            ? "cursor-pointer border-blue-400 bg-blue-50"
                            : "cursor-pointer border-slate-200 bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={includedByPlan}
                          onChange={() => toggleAddon(addon.key)}
                          className="mt-1 h-4 w-4 rounded border-slate-300"
                        />
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {addon.name}
                            {includedByPlan ? (
                              <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold uppercase text-slate-700">
                                Included
                              </span>
                            ) : null}
                          </p>
                          <p className={`text-sm font-semibold ${includedByPlan ? "text-slate-500" : "text-blue-700"}`}>
                            {includedByPlan ? "Included" : usd(addon.price)}
                          </p>
                          <p className="mt-1 text-xs text-slate-600">{addon.description}</p>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
              <p className="mt-4 text-xs text-slate-500">
                All plans include POS integrations, landing page builder, and first year managed hosting + updates.
              </p>
            </section>

            <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-6 sm:p-8">
              <h2 className="text-2xl font-semibold text-slate-900">💰 How much will you save?</h2>
              <div className="mt-5 overflow-x-auto rounded-xl border border-blue-200 bg-white">
                <table className="min-w-[760px] w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">Plan</th>
                      <th className="px-4 py-3">Year 1</th>
                      <th className="px-4 py-3">Year 2</th>
                      <th className="px-4 py-3">Year 3</th>
                      <th className="px-4 py-3">3-Year Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savingsRows.map((row) => (
                      <tr key={row.label} className="border-t border-slate-100">
                        <td className={`px-4 py-3 font-semibold ${row.reserveSit ? "text-blue-700" : "text-slate-700"}`}>{row.label}</td>
                        <td className={`px-4 py-3 ${row.reserveSit ? "text-blue-700 font-semibold" : "text-slate-700"}`}>{row.year1}</td>
                        <td className={`px-4 py-3 ${row.reserveSit ? "text-blue-700 font-semibold" : "text-slate-700"}`}>{row.year2}</td>
                        <td className={`px-4 py-3 ${row.reserveSit ? "text-blue-700 font-semibold" : "text-slate-700"}`}>{row.year3}</td>
                        <td className={`px-4 py-3 font-semibold ${row.reserveSit ? "text-blue-700" : "text-slate-700"}`}>{row.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-sm font-semibold text-blue-800">
                Your annual hosting costs less than one month of OpenTable.
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

                {includedAddonRows.map((addon) => (
                  <div key={`included-${addon.key}`} className="flex items-start justify-between gap-3">
                    <span className="text-slate-600">{addon.name}</span>
                    <span className="font-semibold text-slate-500">Included</span>
                  </div>
                ))}

                <div className="border-t border-slate-200 pt-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium text-slate-800">Total due today</span>
                    <span className="text-lg font-bold text-slate-900">{usd(oneTimeTotal)}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">License + selected add-ons</p>
                </div>

                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Managed Hosting</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    Starting year 2: {usd(selectedPlan.hostingPrice)}/yr managed hosting
                  </p>
                  <p className="mt-1 text-xs text-slate-600">First year is included free with every plan.</p>
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
