"use client";

import { useState } from "react";

const faqs = [
  { q: "What happens after I purchase?", a: "You receive onboarding instructions immediately. Hosted setup is completed within 24 hours." },
  { q: "Do I need technical knowledge?", a: "No. Most restaurants choose our hosted setup and we handle deployment for you." },
  { q: "Can I self-host?", a: "Yes. You can run ReserveSit on your own infrastructure at any time." },
  { q: "What's included in the hosted plan?", a: "Monitoring, backups, updates, and managed uptime for your instance." },
  { q: "How do updates work?", a: "Hosted customers get managed updates. Self-hosted customers get release notes and upgrade steps." },
  { q: "What payment methods do you accept?", a: "All major credit cards through Stripe checkout." },
  { q: "Is there a money-back guarantee?", a: "Yes, 30-day money-back guarantee." },
  { q: "Can I upgrade my plan later?", a: "Yes. You can upgrade anytime and only pay the difference." },
  { q: "How does data migration work?", a: "We offer guided CSV import and migration assistance during onboarding." },
  { q: "Do you integrate with my POS?", a: "We support one-way POS sync options where available and can tailor setup for your stack." },
];

export function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {faqs.map((item, index) => (
        <div key={item.q} className="rounded-xl border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setOpen((v) => (v === index ? null : index))}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span className="text-sm font-semibold text-slate-900">{item.q}</span>
            <span className="text-lg text-slate-500">{open === index ? "−" : "+"}</span>
          </button>
          {open === index ? (
            <div className="border-t border-slate-100 px-4 py-3 text-sm text-slate-600">{item.a}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
