import { AuthGuard } from "@/components/auth-guard";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
