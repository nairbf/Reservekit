"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { PlatformRole } from "@/generated/prisma/client";
import { useToast } from "@/components/toast-provider";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: "▣" },
  { href: "/dashboard/restaurants", label: "Restaurants", icon: "▤" },
  { href: "/dashboard/licenses", label: "Licenses", icon: "⌘" },
  { href: "/dashboard/health", label: "Health", icon: "◉" },
  { href: "/dashboard/traffic", label: "Traffic", icon: "📈" },
  { href: "/dashboard/marketing", label: "Marketing Site", icon: "✦" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙" },
];

function roleText(role: PlatformRole) {
  return role.replace("_", " ");
}

export function DashboardShell({
  user,
  children,
}: {
  user: { name: string; email: string; role: PlatformRole };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { showToast } = useToast();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      showToast("Logout failed. Please try again.", "error");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <div
          className={`fixed inset-0 z-30 bg-slate-950/40 transition-opacity md:hidden ${mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
          onClick={() => setMobileOpen(false)}
        />

        <aside
          className={`fixed left-0 top-0 z-40 h-screen border-r border-slate-800 bg-slate-900 text-slate-100 transition-all duration-200 md:static md:z-auto ${collapsed ? "w-20" : "w-64"} ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
        >
          <div className="flex h-16 items-center justify-between border-b border-slate-800 px-3">
            <div className={`${collapsed ? "hidden" : "block"}`}>
              <p className="text-sm font-semibold">ReserveSit</p>
              <p className="text-xs text-slate-300">Platform Admin</p>
            </div>
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="hidden rounded-lg border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 md:block"
              aria-label="Toggle sidebar"
            >
              {collapsed ? ">" : "<"}
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="rounded-lg border border-slate-700 px-2 py-1 text-xs md:hidden"
            >
              ✕
            </button>
          </div>

          <nav className="space-y-1 p-2">
            {navItems.map((item) => {
              const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-200 ${
                    active ? "bg-slate-100 text-slate-900" : "text-slate-200 hover:bg-slate-800"
                  }`}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="inline-block min-w-4 text-center">{item.icon}</span>
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="flex h-16 items-center justify-between gap-3 px-4 md:px-6">
              <button
                type="button"
                onClick={() => setMobileOpen((v) => !v)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:hidden"
              >
                Menu
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{user.name}</p>
                <p className="truncate text-xs text-slate-500">{user.email} · {roleText(user.role)}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-slate-700 disabled:opacity-60"
              >
                {loggingOut ? "Logging out..." : "Logout"}
              </button>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
