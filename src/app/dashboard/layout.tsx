import { redirect } from "next/navigation";
import { getSession, isMasterAdminEmail } from "@/lib/auth";
import { getEnabledFeatures } from "@/lib/features";
import DashboardNav from "./DashboardNav";
import SetupTourCoach from "./SetupTourCoach";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const features = await getEnabledFeatures();
  const isDemoEnv = (process.env.NEXT_PUBLIC_APP_URL || "").includes("demo");
  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      <DashboardNav
        email={session.email}
        canAccessAdmin={isMasterAdminEmail(session.email)}
        features={features}
      />
      <main className="flex-1 min-w-0 p-4 sm:p-6">
        {isDemoEnv ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
            Demo mode: data resets daily.{" "}
            <a href="https://reservesit.com/pricing" className="font-semibold underline">
              Get your own instance →
            </a>
          </div>
        ) : null}
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>
      <SetupTourCoach />
    </div>
  );
}
