import Link from "next/link";
import { FeatureGrid } from "@/components/feature-grid";
import { PricingCards } from "@/components/pricing-cards";
import { ComparisonTable } from "@/components/comparison-table";
import { DemoForm } from "@/components/demo-form";

const featureCategories = [
  {
    title: "Guest Booking",
    description: "Fast, branded booking experiences that work on mobile and desktop.",
  },
  {
    title: "Service Operations",
    description: "Clear host workflows for requests, arrivals, seating, and table turnover.",
  },
  {
    title: "Insights and Controls",
    description: "Rules, reporting, and capacity controls that protect service quality.",
  },
];

const integrations = ["📍 SpotOn", "🟩 Square", "🍞 Toast", "🍀 Clover", "💳 Stripe"];

export default function LandingPage() {
  return (
    <div>
      <section className="bg-[radial-gradient(circle_at_top,#dbeafe_0%,#eff6ff_35%,#f8fafc_72%)]">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-12">
            <div className="flex-1">
              <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                🚀 Now in production - restaurants are live
              </span>
              <p className="mt-5 text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">ReserveSit</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                The reservation platform you buy once and own.
              </h1>
              <p className="mt-5 max-w-2xl text-lg text-slate-700">
                OpenTable and similar platforms start at $3,000-$3,600/year on their lowest plans - and go up from there. ReserveSit starts at a one-time $2,199 license.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/pricing"
                  className="inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition-all duration-200 hover:bg-blue-700"
                >
                  See Pricing
                </Link>
                <Link
                  href="/demo"
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 transition-all duration-200 hover:bg-slate-100"
                >
                  Book a Demo Call
                </Link>
              </div>
            </div>
            <div className="hidden lg:flex lg:w-[480px] lg:shrink-0 lg:items-center lg:justify-end">
              <img
                src="/dashboard-preview.png"
                alt="ReserveSit dashboard"
                className="w-full drop-shadow-2xl"
                loading="eager"
              />
            </div>
          </div>
        </div>
      </section>

      <section id="demo-preview" className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6">
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-blue-700">👀 See it in action</p>
          <p className="mt-3 max-w-2xl text-slate-700">
            Explore a fully working demo instance with real data. No sign-up required.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="https://demo.reservesit.com/reserve/demo"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition-all duration-200 hover:bg-blue-700"
            >
              Open Live Demo →
            </a>
            <a
              href="https://demo.reservesit.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-blue-300 bg-white px-5 text-sm font-semibold text-blue-700 transition-all duration-200 hover:bg-blue-100"
            >
              View Dashboard →
            </a>
          </div>
          <p className="mt-4 text-sm font-semibold text-blue-800">demo.reservesit.com</p>
        </div>
      </section>

      <section id="features" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-3xl font-semibold text-slate-900">Features Built for Real Service</h2>
        <p className="mt-2 text-slate-600">Everything your team needs to run reservations without subscription lock-in.</p>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {featureCategories.map((category) => (
            <div key={category.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-900">{category.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{category.description}</p>
            </div>
          ))}
        </div>
        <div className="mt-8">
          <FeatureGrid />
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50/30 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-blue-700">🧠 Built-in Intelligence</p>
          <h2 className="mt-3 text-2xl font-bold text-slate-900">
            Your system gets smarter every service.
          </h2>
          <p className="mt-2 max-w-2xl text-slate-600">
            ReserveSit quietly learns your restaurant&apos;s patterns and surfaces insights where your team already looks - no extra setup, no extra cost.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="text-sm"><strong className="text-slate-900">Turn Time Tracking</strong><br /><span className="text-slate-500">Learns how long tables take and predicts availability.</span></div>
            <div className="text-sm"><strong className="text-slate-900">No-Show Risk</strong><br /><span className="text-slate-500">Flags high-risk reservations so you can plan ahead.</span></div>
            <div className="text-sm"><strong className="text-slate-900">Guest Intelligence</strong><br /><span className="text-slate-500">Auto-tags VIPs, first-timers, and lapsed guests.</span></div>
            <div className="text-sm"><strong className="text-slate-900">Smart Waitlist</strong><br /><span className="text-slate-500">Real wait times based on actual table turnover.</span></div>
            <div className="text-sm"><strong className="text-slate-900">Daily Prep Email</strong><br /><span className="text-slate-500">Morning brief with tonight&apos;s VIPs, large parties, and risks.</span></div>
            <div className="text-sm"><strong className="text-slate-900">Pacing Alerts</strong><br /><span className="text-slate-500">Warns when time slots are overpacked.</span></div>
          </div>
          <p className="mt-5 text-xs text-slate-400">All smart features included in every plan. No add-on fees.</p>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-semibold text-slate-900">How It Works</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-blue-700">1</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">Choose your plan</h3>
              <p className="mt-2 text-sm text-slate-600">One-time license with first-year managed hosting included.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-blue-700">2</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">We set you up</h3>
              <p className="mt-2 text-sm text-slate-600">Your branded instance is live within 24 hours.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-blue-700">3</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">Start taking reservations</h3>
              <p className="mt-2 text-sm text-slate-600">Guests book directly on your site and widget.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-16 text-center sm:px-6">
        <h2 className="text-2xl font-semibold text-slate-900">Built for independent restaurants</h2>
        <p className="mx-auto mt-2 max-w-2xl text-slate-600">
          ReserveSit is designed for owner-operated restaurants who want professional reservation
          management without the monthly fees. Own your system, own your data.
        </p>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-3xl font-semibold text-slate-900">Works with your existing tools</h2>
          <p className="mt-2 max-w-3xl text-slate-600">
            Connect your POS and payment systems. Pull menus, sync tables, and accept deposits.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {integrations.map((item) => (
              <span key={item} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="border-y border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-semibold text-slate-900">Pricing</h2>
          <p className="mt-2 text-slate-600">One-time ownership, optional add-ons, and annual managed hosting starting in year 2.</p>
          <div className="mt-8">
            <PricingCards />
          </div>
          <div className="mt-6">
            <Link
              href="/pricing"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition-all duration-200 hover:bg-blue-700"
            >
              View Full Pricing
            </Link>
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

      <section className="border-y border-blue-100 bg-blue-50/70">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-5 px-4 py-14 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="text-3xl font-semibold text-slate-900">Ready to own your reservation system?</h2>
            <p className="mt-2 text-slate-700">Choose your plan or test the live demo first.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/pricing"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition-all duration-200 hover:bg-blue-700"
            >
              Get Started →
            </Link>
            <a
              href="#demo-preview"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 transition-all duration-200 hover:bg-slate-100"
            >
              See It In Action ↓
            </a>
          </div>
        </div>
      </section>

      <section id="demo" className="border-y border-slate-200 bg-[linear-gradient(180deg,#ffffff,#eff6ff)]">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-semibold text-slate-900">Questions? Book a call.</h2>
          <p className="mt-2 text-slate-600">Or just try the live demo - no call needed.</p>
          <div className="mt-8 max-w-3xl">
            <DemoForm />
          </div>
          <div className="mt-8 text-sm text-slate-600">
            Prefer self-serve?{" "}
            <Link href="/pricing" className="font-semibold text-blue-700 underline">
              Go straight to pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
