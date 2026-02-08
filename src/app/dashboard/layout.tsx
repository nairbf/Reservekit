import { redirect } from "next/navigation";
import { getSession, isMasterAdminEmail } from "@/lib/auth";
import DashboardNav from "./DashboardNav";
import SetupTourCoach from "./SetupTourCoach";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav email={session.email} canAccessAdmin={isMasterAdminEmail(session.email)} />
      <main className="p-4 sm:p-6 max-w-6xl mx-auto">{children}</main>
      <SetupTourCoach />
    </div>
  );
}
