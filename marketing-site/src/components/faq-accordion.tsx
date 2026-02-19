"use client";

import { useState } from "react";

const faqs = [
  { q: "How is ReserveSit different from OpenTable?", a: "OpenTable charges per cover and per month, owns your guest data, and can cost $3,000-$7,000/year. ReserveSit is a one-time license - you own it outright, keep all your data, and pay nothing per cover." },
  { q: "Can I try it before buying?", a: "Yes! Our live demo at demo.reservesit.com is a fully working instance with real data that resets nightly. No sign-up required." },
  { q: "What happens after I purchase?", a: "You receive onboarding instructions immediately. Hosted setup is completed within 24 hours." },
  { q: "What if I need help setting up?", a: "Our hosted plan includes full setup - we configure your instance, import your tables and schedule, and have you live within 24 hours." },
  { q: "Do I need technical knowledge?", a: "No. Most restaurants choose our hosted setup and we handle deployment for you." },
  { q: "Do guests need to create an account to book?", a: "No. Guests simply enter their name, email, phone, and preferred time. No app download or account creation required." },
  { q: "Can I self-host?", a: "Yes. You can run ReserveSit on your own infrastructure at any time." },
  { q: "Can I customize the booking page?", a: "Yes. You can set your restaurant name, logo, accent colors, and a custom hero image. The booking widget matches your brand." },
  { q: "What's included in the hosted plan?", a: "Monitoring, backups, updates, and managed uptime for your instance." },
  { q: "How do deposits and no-show fees work?", a: "You connect your own Stripe account. Deposits go directly to you - we never hold your money. You control deposit amounts, minimum party sizes, and no-show policies." },
  { q: "Can my staff have different access levels?", a: "Yes. You can assign Admin, Manager, or Host roles with custom permission toggles per user. A host can check in guests while a manager handles the schedule." },
  { q: "How do updates work?", a: "Hosted customers get managed updates. Self-hosted customers get release notes and upgrade steps." },
  { q: "What payment methods do you accept?", a: "All major credit cards through Stripe checkout." },
  { q: "Is there a money-back guarantee?", a: "Yes, 30-day money-back guarantee." },
  { q: "Can I upgrade my plan later?", a: "Yes. You can upgrade anytime and only pay the difference." },
  { q: "How does data migration work?", a: "We offer guided CSV import and migration assistance during onboarding." },
  { q: "Do you integrate with my POS?", a: "We support one-way POS sync options where available and can tailor setup for your stack." },
  { q: "What happens if I want to cancel?", a: "Monthly hosted plans can be canceled anytime. One-time license purchases include a 30-day money-back guarantee. Your data is always exportable." },
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
