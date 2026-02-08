import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Link from "next/link";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-3 flex items-center gap-6 overflow-x-auto">
        <span className="font-bold text-lg mr-4 shrink-0">ReserveKit</span>
        <Link href="/dashboard" className="text-sm hover:text-blue-600 shrink-0">Inbox</Link>
        <Link href="/dashboard/tonight" className="text-sm hover:text-blue-600 shrink-0">Tonight</Link>
        <Link href="/dashboard/tables" className="text-sm hover:text-blue-600 shrink-0">Tables</Link>
        <Link href="/dashboard/schedule" className="text-sm hover:text-blue-600 shrink-0">Schedule</Link>
        <Link href="/dashboard/reports" className="text-sm hover:text-blue-600 shrink-0">Reports</Link>
        <Link href="/dashboard/settings" className="text-sm hover:text-blue-600 shrink-0">Settings</Link>
        <div className="ml-auto text-sm text-gray-500 shrink-0">{session.email}</div>
      </nav>
      <main className="p-4 max-w-5xl mx-auto">{children}</main>
    </div>
  );
}
