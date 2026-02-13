import Link from "next/link";
import { PortalDashboard } from "@/components/portal-dashboard";

export default function PortalPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">Welcome back.</p>
        <Link href="/portal/support" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700">Support</Link>
      </div>
      <PortalDashboard />
    </div>
  );
}
