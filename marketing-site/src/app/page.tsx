import Link from "next/link";
import { FeatureGrid } from "@/components/feature-grid";
import { PricingCards } from "@/components/pricing-cards";
import { ComparisonTable } from "@/components/comparison-table";
import { DemoForm } from "@/components/demo-form";

const testimonials = [
  {
    quote: "We replaced a costly subscription and were fully live in a weekend.",
    author: "Owner, Harbor House",
  },
  {
    quote: "Our host team finally has one clear workflow for requests and arrivals.",
    author: "GM, Midtown Bistro",
  },
  {
    quote: "The one-time license model made budgeting predictable immediately.",
    author: "Operations Lead, The Reef",
  },
];

export default function LandingPage() {
  return (
    <div>
      <section className="bg-[radial-gradient(circle_at_top,#dbeafe_0%,#eff6ff_35%,#f8fafc_70%)]">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">ReserveSit</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            The reservation platform you buy once and own.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-700">
            Legacy platforms cost $3,500+/year. ReserveSit is a one-time license starting at $1,799.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#pricing" className="inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition-all duration-200 hover:bg-blue-700">
              See Pricing
            </a>
            <a href="#demo" className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 transition-all duration-200 hover:bg-slate-100">
              Book a Demo
            </a>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-3xl font-semibold text-slate-900">Features Built for Real Service</h2>
        <p className="mt-2 text-slate-600">Everything your team needs to run reservations without subscription lock-in.</p>
        <div className="mt-8">
          <FeatureGrid />
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-semibold text-slate-900">How It Works</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-blue-700">1</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">Choose your plan and purchase</h3>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-blue-700">2</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">We set up your hosted instance in 24 hours</h3>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-blue-700">3</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">Configure tables, hours, and go live</h3>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-semibold text-slate-900">Trusted by growing operators</h2>
            <p className="mt-2 text-slate-600">Trusted by <strong>42 restaurants</strong> and counting.</p>
          </div>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {testimonials.map((t) => (
            <blockquote key={t.author} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-700">“{t.quote}”</p>
              <footer className="mt-3 text-xs font-semibold text-slate-500">{t.author}</footer>
            </blockquote>
          ))}
        </div>
      </section>

      <section id="pricing" className="border-y border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-semibold text-slate-900">Pricing</h2>
          <p className="mt-2 text-slate-600">One-time license options plus flexible add-ons.</p>
          <div className="mt-8">
            <PricingCards />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-3xl font-semibold text-slate-900">ReserveSit vs Alternatives</h2>
        <p className="mt-2 text-slate-600">See the cost and ownership difference in year one and beyond.</p>
        <div className="mt-8">
          <ComparisonTable />
        </div>
      </section>

      <section id="demo" className="border-y border-slate-200 bg-[linear-gradient(180deg,#ffffff,#eff6ff)]">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-semibold text-slate-900">Book a Demo</h2>
          <p className="mt-2 text-slate-600">Tell us about your operation and we’ll walk you through a live setup.</p>
          <div className="mt-8 max-w-3xl">
            <DemoForm />
          </div>
          <div className="mt-8 text-sm text-slate-600">
            Prefer self-serve? <Link href="/pricing" className="font-semibold text-blue-700 underline">Go straight to pricing</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
