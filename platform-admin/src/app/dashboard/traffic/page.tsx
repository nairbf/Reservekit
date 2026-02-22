function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export default function TrafficPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Traffic</h1>
          <p className="text-sm text-slate-600">Google Analytics overview for reservesit.com.</p>
        </div>
        <a
          href="https://analytics.google.com/analytics/web/#/p13649145751/reports/intelligenthome"
          target="_blank"
          rel="noreferrer"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Open GA4 →
        </a>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Active Users Right Now" value="View in GA4" />
        <StatCard label="Sessions Today" value="View in GA4" />
        <StatCard label="Top Page" value="View in GA4" />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Realtime Overview</h2>
          <p className="mt-1 text-xs text-slate-500">
            If the embed does not render, open Google Analytics in a new tab below.
          </p>
        </div>
        <div className="h-[600px] overflow-hidden rounded-b-2xl">
          <iframe
            src="https://analytics.google.com/analytics/web/#/p13649145751/realtime/overview"
            className="h-full w-full border-0"
            title="Google Analytics Realtime"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Quick Links</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href="https://analytics.google.com/analytics/web/#/p13649145751/reports/intelligenthome"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Full GA4 Dashboard
          </a>
          <a
            href="https://analytics.google.com/analytics/web/#/p13649145751/reports/reportinghub?params=_u..nav%3Dmaui"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Acquisition Report
          </a>
          <a
            href="https://analytics.google.com/analytics/web/#/p13649145751/reports/reportinghub?params=_u..nav%3Dmaui%26_r.explorerCard..openDetails%3Dtrue"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Conversion Report
          </a>
        </div>
      </section>
    </div>
  );
}
