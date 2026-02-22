import type { Metadata } from "next";
import { fetchMarketingSettings, withMarketingDefaults } from "@/lib/marketing-settings";

export const metadata: Metadata = {
  title: "About",
  description: "ReserveSit was built to give independent restaurants the same technology as big chains - without recurring fees or data lock-in.",
};

const differentiators = [
  {
    title: "You Own It",
    icon: "🏠",
    body: "One-time license, your data, and your infrastructure if you want full control.",
  },
  {
    title: "Predictable Cost",
    icon: "💰",
    body: "No per-cover fees and no surprise price hikes when your bookings grow.",
  },
  {
    title: "POS Integration",
    icon: "🔌",
    body: "Connect SpotOn, Square, Toast, or Clover to keep service data aligned.",
  },
  {
    title: "Real Support",
    icon: "🛡️",
    body: "Direct access to the team that built ReserveSit when you need help.",
  },
];

export default async function AboutPage() {
  const settings = withMarketingDefaults(await fetchMarketingSettings());

  return (
    <div className="bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_55%)]">
      <div className="mx-auto w-full max-w-5xl space-y-14 px-4 py-16 sm:px-6">
        <section>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">About ReserveSit</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">{settings.about_headline}</h1>
          <p className="mt-4 max-w-3xl text-lg text-slate-700">
            {settings.about_body}
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-2xl font-semibold text-slate-900">The Problem</h2>
          <div className="mt-4 space-y-4 text-slate-700">
            <p>
              Legacy reservation platforms often charge restaurants both monthly fees and per-cover costs. As volume grows, the bill grows with it,
              and operators end up paying more every year for the same core workflow.
            </p>
            <p>
              Many of those platforms also sit between you and your guests. That means limited control over guest data, communication settings,
              and the full booking experience on your own brand.
            </p>
            <p>
              Once everything is tied to one provider, switching becomes painful. Teams get locked into pricing and product decisions they did not choose.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-2xl font-semibold text-slate-900">Our Approach</h2>
          <div className="mt-4 space-y-4 text-slate-700">
            <p>ReserveSit uses a one-time license model so restaurants can own their reservation software outright.</p>
            <p>You keep full ownership of your guest and reservation data.</p>
            <p>Self-host if you want total infrastructure control, or choose managed hosting and let us run it for you.</p>
            <p>No per-cover fees, no commissions, and no lock-in pricing traps.</p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-slate-900">What Makes Us Different</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {differentiators.map((item) => (
              <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-2xl">{item.icon}</p>
                <h3 className="mt-3 text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-700">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-blue-100 bg-blue-50 p-6 sm:p-8">
          <h2 className="text-2xl font-semibold text-slate-900">Contact</h2>
          <div className="mt-4 space-y-2 text-slate-700">
            <p>
              Email: <a href="mailto:hello@reservesit.com" className="font-semibold text-blue-700 underline">hello@reservesit.com</a>
            </p>
            <p>
              Support: <a href="mailto:support@reservesit.com" className="font-semibold text-blue-700 underline">support@reservesit.com</a>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
