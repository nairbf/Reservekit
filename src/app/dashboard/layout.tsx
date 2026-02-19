import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getAppUrl } from "@/lib/app-url";
import { getEnabledFeatures } from "@/lib/features";
import { PermissionsProvider } from "@/hooks/use-permissions";
import { DemoNav } from "@/components/demo-nav";
import DashboardNav from "./DashboardNav";
import SetupTourCoach from "./SetupTourCoach";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const features = await getEnabledFeatures();
  const appUrl = await getAppUrl();
  const isDemoEnv = appUrl.includes("demo.reservesit.com");
  const permissionList = Array.from(session.permissions);
  const canAccessAdmin = session.permissions.has("manage_staff");
  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      <DashboardNav
        email={session.email}
        canAccessAdmin={canAccessAdmin}
        permissions={permissionList}
        features={features}
      />
      <main className="flex-1 min-w-0 p-4 sm:p-6">
        {isDemoEnv ? (
          <div className="mb-4 overflow-hidden rounded-lg border border-amber-200">
            <div className="bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
              Demo mode: data resets daily.{" "}
              <a href="https://reservesit.com/pricing" className="font-semibold underline">
                Get your own instance →
              </a>
            </div>
            <DemoNav />
          </div>
        ) : null}
        <div className="max-w-6xl mx-auto">
          <PermissionsProvider permissions={permissionList}>{children}</PermissionsProvider>
        </div>
      </main>
      <SetupTourCoach />
    </div>
  );
}
