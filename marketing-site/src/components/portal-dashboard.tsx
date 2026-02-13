"use client";

import { useState } from "react";

export function PortalDashboard() {
  const [revealed, setRevealed] = useState(false);
  const license = "RS-LIC-4f7f1f2c-0f7a-44c2-a121-2c7f0341a5ab";
  const masked = `${license.slice(0, 8)}••••••••${license.slice(-6)}`;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Customer Portal</h1>
      <p className="text-sm text-slate-600">Manage your ReserveSit license and hosted instance details.</p>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">License</h2>
          <p className="mt-2 font-mono text-sm text-slate-900">{revealed ? license : masked}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setRevealed((v) => !v)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold">
              {revealed ? "Hide" : "Reveal"}
            </button>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(license);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold"
            >
              Copy
            </button>
          </div>
          <p className="mt-4 text-sm text-slate-700">Plan: <strong>Service Pro</strong></p>
          <p className="text-sm text-slate-700">Purchase date: <strong>Jan 14, 2026</strong></p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Instance</h2>
          <p className="mt-2 text-sm text-slate-700">
            URL: <a className="font-semibold text-blue-700 underline" href="https://reef.reservesit.com" target="_blank" rel="noreferrer">reef.reservesit.com</a>
          </p>
          <p className="mt-1 text-sm text-slate-700">Status: <span className="font-semibold text-emerald-700">Active</span></p>
          <p className="mt-1 text-sm text-slate-700">Hosting: <strong>Managed</strong> · Next billing: <strong>Mar 1, 2026</strong></p>
          <p className="mt-3 text-sm text-slate-700">Support: <a className="text-blue-700 underline" href="mailto:support@reservesit.com">support@reservesit.com</a></p>
          <button type="button" className="mt-4 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Download Invoice</button>
        </div>
      </div>
    </div>
  );
}
