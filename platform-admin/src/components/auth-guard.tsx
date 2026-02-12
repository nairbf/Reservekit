"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SessionUser } from "@/components/session-provider";
import { SessionProvider } from "@/components/session-provider";
import { DashboardShell } from "@/components/dashboard-shell";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me", {
          cache: "no-store",
          credentials: "include",
        });

        if (!res.ok) throw new Error("Unauthorized");

        const payload = (await res.json()) as { user?: SessionUser };
        if (mounted && payload.user) {
          setUser(payload.user);
        } else if (mounted) {
          router.replace("/login");
        }
      } catch {
        if (mounted) router.replace("/login");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void checkAuth();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <SessionProvider user={user}>
      <DashboardShell user={user}>{children}</DashboardShell>
    </SessionProvider>
  );
}
