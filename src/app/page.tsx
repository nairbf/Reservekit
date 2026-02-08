"use client";
import { useState } from "react";

export default function LandingPage() {
  const [addons, setAddons] = useState<string[]>([]);
  const [email, setEmail] = useState("");

  function toggle(id: string) {
    setAddons(a => a.includes(id) ? a.filter(x => x !== id) : [...a, id]);
  }

  const addonList = [
    { id: "sms", name: "SMS Notifications", price: 79, desc: "Twilio-powered confirmations, reminders, guest replies" },
    { id: "floorplan", name: "Visual Floor Plan", price: 99, desc: "Drag-and-drop table layout with live status" },
    { id: "reports", name: "Reporting Dashboard", price: 49, desc: "Covers, no-show rate, peak hours, source breakdown" },
    { id: "guesthistory", name: "Guest History", price: 49, desc: "Track repeat visitors, visit count, notes per guest" },
  ];
  const total = 299 + addonList.filter(a => addons.includes(a.id)).reduce((s, a) => s + a.price, 0);

  async function checkout() {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: ["core", ...addons], email }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else alert(data.error || "Checkout failed");
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-6 py-20 text-center">
        <h1 className="text-5xl font-bold mb-4">ReserveKit</h1>
        <p className="text-xl text-gray-600 mb-2">The reservation system you buy once and own forever.</p>
        <p className="text-gray-500 mb-8">No monthly fees. No per-cover charges. No middleman.</p>
        <a href="#pricing" className="w-full sm:w-auto inline-flex items-center justify-center bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-medium transition-all duration-200">See Pricing</a>
      </div>

      <div className="bg-gray-50 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">Everything a restaurant needs</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { t: "Guest Widget", d: "Embed on your website. Guests pick date, time, party size." },
              { t: "Hostess Dashboard", d: "Tablet-friendly. Approve requests, track arrivals, manage tables." },
              { t: "Email Built In", d: "Automatic emails on every status change. Uses your own email." },
              { t: "Walk-ins & Phone", d: "Add walk-ins and phone reservations in seconds." },
              { t: "Smart Availability", d: "Prevents overbooking based on capacity and dining duration." },
              { t: "You Own It", d: "Self-host or we host for $15/mo. Your data is always yours." },
            ].map(f => (
              <div key={f.t} className="bg-white rounded-lg p-6 shadow-sm">
                <h3 className="font-bold mb-2">{f.t}</h3>
                <p className="text-gray-600 text-sm">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div id="pricing" className="py-16">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4">One price. Own it forever.</h2>
          <p className="text-center text-gray-600 mb-12">Pay once, get the core system. Add what you need.</p>
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-6">
            <div className="flex flex-wrap justify-between items-start gap-3">
              <div>
                <h3 className="text-xl font-bold">Core System</h3>
                <p className="text-gray-600 text-sm mt-1">Widget + Dashboard + Tables + Email + Walk-ins</p>
              </div>
              <div className="text-3xl font-bold">$299</div>
            </div>
            <p className="text-blue-600 text-sm mt-2">One-time payment. Includes all future updates.</p>
          </div>

          <h3 className="font-bold text-lg mb-3">Optional Add-Ons</h3>
          <div className="space-y-3 mb-8">
            {addonList.map(a => (
              <label key={a.id} className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${addons.includes(a.id) ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={addons.includes(a.id)} onChange={() => toggle(a.id)} className="w-4 h-4" />
                  <div>
                    <div className="font-medium">{a.name}</div>
                    <div className="text-sm text-gray-500">{a.desc}</div>
                  </div>
                </div>
                <div className="font-bold text-lg">${a.price}</div>
              </label>
            ))}
          </div>

          <div className="bg-gray-50 rounded-xl p-6">
            <div className="flex justify-between items-center mb-4"><span className="text-lg font-bold">Total</span><span className="text-3xl font-bold">${total}</span></div>
            <input type="email" placeholder="Your email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border rounded-lg px-4 py-2 mb-3" />
            <button onClick={checkout} disabled={!email} className="w-full h-12 bg-blue-600 text-white rounded-lg text-lg font-medium disabled:opacity-50 transition-all duration-200">Purchase Now</button>
            <p className="text-xs text-gray-400 text-center mt-3">Secure payment via Stripe. 30-day money-back guarantee.</p>
          </div>

          <div className="mt-8 p-4 bg-gray-50 rounded-lg text-center">
            <p className="font-medium">Don&apos;t want to self-host?</p>
            <p className="text-gray-600 text-sm">We&apos;ll host it for you — $15/month. Servers, backups, updates included.</p>
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
                    <th className="p-4 text-center font-bold text-blue-600">ReserveKit</th>
                    <th className="p-4 text-center">OpenTable</th>
                    <th className="p-4 text-center">Resy</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Upfront cost", "$299 once", "$0", "$0"],
                    ["Monthly fee", "$0–$15", "$249–$449", "$249–$899"],
                    ["Per-cover fee", "Never", "$0.25–$1.00", "None"],
                    ["Year 1 cost", "$299–$479", "$3,888+", "$2,988+"],
                    ["Own your data", "✓", "✗", "✗"],
                    ["Self-hostable", "✓", "✗", "✗"],
                  ].map(([l, ...v]) => (
                    <tr key={l} className="border-b last:border-0">
                      <td className="p-4 font-medium">{l}</td>
                      {v.map((c, i) => (
                        <td key={i} className={`p-4 text-center ${i === 0 ? "font-medium text-blue-600" : "text-gray-600"}`}>{c}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <footer className="py-8 text-center text-gray-400 text-sm">ReserveKit — Your reservations. Your guests. Your data.</footer>
    </div>
  );
}
