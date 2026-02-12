import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { SessionProvider } from "@/components/session-provider";
import { DashboardShell } from "@/components/dashboard-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <SessionProvider user={session}>
      <DashboardShell user={session}>{children}</DashboardShell>
    </SessionProvider>
  );
}
