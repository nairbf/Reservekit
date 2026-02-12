import { AuthGuard } from "@/components/auth-guard";

export const runtime = "nodejs";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
