"use client";
import { useMemo, useState } from "react";

type AddOnId = "sms" | "floorplan" | "reports" | "guesthistory" | "eventticketing";

interface AddOn {
  id: AddOnId;
  name: string;
  price: number;
  desc: string;
}

interface Bundle {
  id: string;
  name: string;
  items: Array<"core" | AddOnId>;
  note: string;
}

const CORE_PRICE = 1799;

const ADD_ONS: AddOn[] = [
  { id: "sms", name: "SMS Notifications", price: 199, desc: "Twilio-powered confirmations, reminders, and guest replies" },
  { id: "floorplan", name: "Visual Floor Plan", price: 249, desc: "Drag-and-drop layout with live table state" },
  { id: "reports", name: "Reporting Dashboard", price: 179, desc: "Covers, no-show trends, and service performance" },
  { id: "guesthistory", name: "Guest History", price: 179, desc: "Repeat-guest timeline, notes, and loyalty context" },
  { id: "eventticketing", name: "Event Ticketing", price: 129, desc: "Sell pre-paid tickets for dinners and special events" },
];

const BUNDLES: Bundle[] = [
  { id: "core", name: "Core", items: ["core"], note: "Best for launch and owner-operator teams" },
  { id: "service", name: "Service Pro", items: ["core", "floorplan", "reports"], note: "Most popular for full-service dining rooms" },
  { id: "full", name: "Full Suite", items: ["core", "sms", "floorplan", "reports", "guesthistory", "eventticketing"], note: "Maximum control with every add-on included" },
];

function totalFor(items: Array<"core" | AddOnId>): number {
  return items.reduce((sum, item) => {
    if (item === "core") return sum + CORE_PRICE;
    const addOn = ADD_ONS.find(entry => entry.id === item);
    return sum + (addOn ? addOn.price : 0);
  }, 0);
}

export default function LandingPage() {
  const [addons, setAddons] = useState<AddOnId[]>([]);
  const [email, setEmail] = useState("");
  const [checkoutTarget, setCheckoutTarget] = useState<string | null>(null);

  const customTotal = useMemo(
    () => totalFor(["core", ...addons]),
    [addons],
  );

  function toggle(id: AddOnId) {
    setAddons(current => (current.includes(id) ? current.filter(value => value !== id) : [...current, id]));
  }

  async function startCheckout(items: Array<"core" | AddOnId>, source: string) {
    setCheckoutTarget(source);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, email }),
      });
      const data = await res.json();
      if (!data.url) {
        alert(data.error || "Checkout failed");
        return;
      }
      const opened = window.open(data.url, "_blank", "noopener,noreferrer");
      if (!opened) window.location.href = data.url;
    } finally {
      setCheckoutTarget(null);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-6 py-20 text-center">
        <h1 className="text-5xl font-bold mb-4">ReserveSit</h1>
        <p className="text-xl text-gray-600 mb-2">The reservation platform you buy once and own.</p>
        <p className="text-gray-500 mb-8">Legacy platforms can run $3,500+/year. ReserveSit is a one-time license.</p>
        <a href="#pricing" className="w-full sm:w-auto inline-flex items-center justify-center bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-medium transition-all duration-200">See Pricing</a>
      </div>

      <div className="bg-gray-50 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">Everything a restaurant needs</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { t: "Guest Widget", d: "Embed on your website. Guests pick date, time, and party size." },
              { t: "Hostess Dashboard", d: "Tablet-friendly workflows for requests, arrivals, and tables." },
              { t: "Email Built In", d: "Automatic status emails from your own SMTP credentials." },
              { t: "Walk-ins & Phone", d: "Capture in-person and call-in demand in seconds." },
              { t: "Event Ticketing", d: "Run wine dinners, holiday seatings, and paid special events." },
              { t: "Smart Availability", d: "Capacity rules prevent overbooking during peak periods." },
              { t: "You Own It", d: "Self-host or have us host for $15/month with backups." },
            ].map(feature => (
              <div key={feature.t} className="bg-white rounded-lg p-6 shadow-sm">
                <h3 className="font-bold mb-2">{feature.t}</h3>
                <p className="text-gray-600 text-sm">{feature.d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div id="pricing" className="py-16">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4">Pricing Built To Win Against Annual Contracts</h2>
          <p className="text-center text-gray-600 mb-8">Higher value than budget software, still well below yearly legacy costs.</p>

          <div className="max-w-xl mx-auto bg-gray-50 rounded-xl p-5 mb-8">
            <label className="block text-sm font-medium mb-2 text-left">Purchaser Email</label>
            <input
              type="email"
              placeholder="owner@restaurant.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border rounded-lg px-4 py-2"
            />
            <p className="text-xs text-gray-500 mt-2 text-left">All plan checkout buttons open Stripe in a new tab.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-8">
            {BUNDLES.map(bundle => {
              const bundleTotal = totalFor(bundle.items);
              const featured = bundle.id === "service";
              return (
                <div key={bundle.id} className={`rounded-xl border p-5 ${featured ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"}`}>
                  <div className="text-sm uppercase tracking-wide text-gray-500">{bundle.name}</div>
                  <div className="text-3xl font-bold mt-1">${bundleTotal}</div>
                  <p className="text-sm text-gray-600 mt-2">{bundle.note}</p>
                  <button
                    onClick={() => startCheckout(bundle.items, `bundle-${bundle.id}`)}
                    disabled={!email || checkoutTarget !== null}
                    className={`mt-4 w-full h-11 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 ${featured ? "bg-blue-600 text-white" : "bg-gray-900 text-white"}`}
                  >
                    {checkoutTarget === `bundle-${bundle.id}` ? "Opening..." : "Choose Plan"}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-6">
            <div className="flex flex-wrap justify-between items-start gap-3">
              <div>
                <h3 className="text-xl font-bold">Core License</h3>
                <p className="text-gray-600 text-sm mt-1">Widget, dashboard, tables, approvals, notifications, walk-ins</p>
              </div>
              <div className="text-3xl font-bold">${CORE_PRICE}</div>
            </div>
            <p className="text-blue-700 text-sm mt-2">One-time payment, includes updates.</p>
            <button
              onClick={() => startCheckout(["core"], "core-only")}
              disabled={!email || checkoutTarget !== null}
              className="mt-4 h-11 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium transition-all duration-200 disabled:opacity-50"
            >
              {checkoutTarget === "core-only" ? "Opening..." : "Buy Core In New Tab"}
            </button>
          </div>

          <h3 className="font-bold text-lg mb-3">Build Your Own Package</h3>
          <div className="space-y-3 mb-8">
            {ADD_ONS.map(addon => (
              <label key={addon.id} className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${addons.includes(addon.id) ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={addons.includes(addon.id)} onChange={() => toggle(addon.id)} className="w-4 h-4" />
                  <div>
                    <div className="font-medium">{addon.name}</div>
                    <div className="text-sm text-gray-500">{addon.desc}</div>
                  </div>
                </div>
                <div className="font-bold text-lg">${addon.price}</div>
              </label>
            ))}
          </div>

          <div className="bg-gray-50 rounded-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-bold">Custom Total</span>
              <span className="text-3xl font-bold">${customTotal}</span>
            </div>
            <button
              onClick={() => startCheckout(["core", ...addons], "custom")}
              disabled={!email || checkoutTarget !== null}
              className="w-full h-12 bg-blue-600 text-white rounded-lg text-lg font-medium disabled:opacity-50 transition-all duration-200"
            >
              {checkoutTarget === "custom" ? "Opening..." : "Open Checkout In New Tab"}
            </button>
            <p className="text-xs text-gray-400 text-center mt-3">Secure payment via Stripe. 30-day money-back guarantee.</p>
          </div>

          <div className="mt-8 p-4 bg-gray-50 rounded-lg text-center">
            <p className="font-medium">Prefer managed hosting?</p>
            <p className="text-gray-600 text-sm">Add hosted deployment for $15/month with monitoring, backups, and updates.</p>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-8">vs. the alternatives</h2>
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-4"></th>
                    <th className="p-4 text-center font-bold text-blue-600">ReserveSit</th>
                    <th className="p-4 text-center">OpenTable</th>
                    <th className="p-4 text-center">Resy</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Upfront cost", "$1,799 once", "$0", "$0"],
                    ["Monthly fee", "$0-$15", "$249-$449", "$249-$899"],
                    ["Per-cover fee", "Never", "$0.25-$1.00", "None"],
                    ["Year 1 (core only)", "$1,799-$1,979", "$3,500+", "$2,988+"],
                    ["Year 2 (core only)", "$0-$180", "$3,500+", "$2,988+"],
                    ["2-Year total (core only)", "$1,799-$2,159", "$7,000+", "$5,976+"],
                    ["Extra paid after 2 years", "-", "$4,841+ more", "$3,817+ more"],
                    ["Year 1 (full suite)", "$2,734-$2,914", "$3,500+ plus cover fees", "$2,988+"],
                    ["Own your data", "Yes", "No", "No"],
                    ["Self-hostable", "Yes", "No", "No"],
                  ].map(([label, ...values]) => (
                    <tr key={label} className="border-b last:border-0">
                      <td className="p-4 font-medium">{label}</td>
                      {values.map((cell, index) => (
                        <td key={index} className={`p-4 text-center ${index === 0 ? "font-medium text-blue-600" : "text-gray-600"}`}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 bg-white rounded-xl shadow p-5">
            <h3 className="text-lg font-bold">Break-even timeline (Core + hosted)</h3>
            <p className="text-sm text-gray-600 mt-1">How fast ReserveSit recoups its one-time cost versus monthly subscriptions.</p>
            <div className="space-y-4 mt-4">
              {[
                { label: "vs OpenTable ($249/mo)", months: 8, tone: "bg-orange-500" },
                { label: "vs OpenTable ($449/mo)", months: 5, tone: "bg-orange-600" },
                { label: "vs Resy ($249/mo)", months: 8, tone: "bg-gray-600" },
                { label: "vs Resy ($899/mo)", months: 3, tone: "bg-gray-700" },
              ].map(entry => (
                <div key={entry.label}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">{entry.label}</span>
                    <span className="text-blue-700 font-semibold">{entry.months} months</span>
                  </div>
                  <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-3 rounded-full ${entry.tone}`}
                      style={{ width: `${Math.round((entry.months / 12) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-sm text-blue-700 font-medium mt-4">Every scenario above breaks even inside year one.</p>
          </div>

          <div className="mt-6 bg-white rounded-xl shadow overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h3 className="text-lg font-bold">Feature comparison</h3>
              <p className="text-sm text-gray-600 mt-1">See what your team can run in ReserveSit compared to subscription alternatives.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left p-4 font-semibold">Feature</th>
                    <th className="p-4 text-center font-bold text-blue-700">ReserveSit</th>
                    <th className="p-4 text-center font-semibold text-gray-700">OpenTable</th>
                    <th className="p-4 text-center font-semibold text-gray-700">Resy</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Embeddable booking widget", "Included", "Included", "Included"],
                    ["Manual request approvals", "Included", "Limited", "Limited"],
                    ["Waitlist management", "Included", "Tier dependent", "Tier dependent"],
                    ["Visual floor plan", "Available add-on", "Tier dependent", "Tier dependent"],
                    ["Guest history + notes", "Available add-on", "Tier dependent", "Tier dependent"],
                    ["Deposits and no-show protection", "Included", "Tier dependent", "Tier dependent"],
                    ["Event ticketing", "Available add-on", "Limited", "Limited"],
                    ["POS table-status sync", "Available add-on", "Varies", "Varies"],
                    ["Data ownership and self-host option", "Yes", "No", "No"],
                  ].map(([feature, ours, ot, resy]) => (
                    <tr key={feature} className="border-b last:border-0">
                      <td className="p-4 font-medium text-gray-900">{feature}</td>
                      <td className="p-4 text-center font-semibold text-blue-700">{ours}</td>
                      <td className="p-4 text-center text-gray-600">{ot}</td>
                      <td className="p-4 text-center text-gray-600">{resy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <footer className="py-8 text-center text-gray-400 text-sm">ReserveSit - Your reservations. Your guests. Your data.</footer>
    </div>
  );
}
