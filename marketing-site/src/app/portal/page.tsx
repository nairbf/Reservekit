import Link from "next/link";
import { PortalDashboard } from "@/components/portal-dashboard";

export default function PortalPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">Welcome back.</p>
        <Link href="/portal/support" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700">Support</Link>
      </div>

      <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 p-5">
        <h2 className="text-base font-semibold text-slate-900">Domain &amp; URL</h2>
        <p className="mt-1 text-sm text-slate-700">
          Manage your custom domain or upgrade from your included ReserveSit URL.
        </p>
        <Link
          href="/portal/domain"
          className="mt-3 inline-flex h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white"
        >
          Manage Domain →
        </Link>
      </div>

      <PortalDashboard />
    </div>
  );
}
