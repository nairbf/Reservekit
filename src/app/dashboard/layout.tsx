import { redirect } from "next/navigation";
import { getSession, isMasterAdminEmail } from "@/lib/auth";
import { getEnabledFeatures } from "@/lib/features";
import DashboardNav from "./DashboardNav";
import SetupTourCoach from "./SetupTourCoach";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const features = await getEnabledFeatures();
  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      <DashboardNav
        email={session.email}
        canAccessAdmin={isMasterAdminEmail(session.email)}
        features={features}
      />
      <main className="flex-1 min-w-0 p-4 sm:p-6">
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>
      <SetupTourCoach />
    </div>
  );
}
