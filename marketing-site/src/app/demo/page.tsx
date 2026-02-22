import type { Metadata } from "next";
import { DemoForm } from "@/components/demo-form";
import { fetchMarketingSettings, withMarketingDefaults } from "@/lib/marketing-settings";

export const metadata: Metadata = {
  title: "Demo",
  description: "Try ReserveSit live - explore a fully working demo instance with real data. No sign-up required.",
};

export default async function DemoPage() {
  const settings = withMarketingDefaults(await fetchMarketingSettings());

  return (
    <div className="bg-[linear-gradient(180deg,#eff6ff_0%,#ffffff_60%)]">
      <div className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6">
        <section className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">{settings.demo_page_headline}</h1>
          <p className="mt-3 text-slate-700">{settings.demo_page_body}</p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a
              href="https://demo.reservesit.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition-all duration-200 hover:bg-blue-700"
            >
              Open Dashboard Demo →
            </a>
            <a
              href="https://demo.reservesit.com/reserve/demo"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 transition-all duration-200 hover:bg-slate-100"
            >
              Try Guest Booking View →
            </a>
          </div>

          <div className="my-8 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            <span>or</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <h2 className="text-2xl font-semibold text-slate-900">Want a personalized walkthrough?</h2>
          <div className="mt-5">
            <DemoForm />
          </div>
        </section>
      </div>
    </div>
  );
}
