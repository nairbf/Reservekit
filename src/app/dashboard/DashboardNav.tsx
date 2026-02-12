"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/dashboard", label: "Inbox", icon: "IN" },
  { href: "/dashboard/tonight", label: "Tonight", icon: "TN" },
  { href: "/dashboard/kitchen", label: "Kitchen", icon: "KT" },
  { href: "/dashboard/waitlist", label: "Waitlist", icon: "WL" },
  { href: "/dashboard/tables", label: "Tables", icon: "TB" },
  { href: "/dashboard/floorplan", label: "Floor Plan", icon: "FP" },
  { href: "/dashboard/schedule", label: "Schedule", icon: "SC" },
  { href: "/dashboard/reports", label: "Reports", icon: "RP" },
  { href: "/dashboard/events", label: "Events", icon: "EV" },
  { href: "/dashboard/menu", label: "Menu", icon: "MN" },
  { href: "/dashboard/guests", label: "Guests", icon: "GS" },
  { href: "/dashboard/settings", label: "Settings", icon: "ST" },
];

const SIDEBAR_STORAGE_KEY = "dashboardSidebarCollapsed";

export default function DashboardNav({ email, canAccessAdmin }: { email: string; canAccessAdmin: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [restaurantName, setRestaurantName] = useState("ReserveSit");

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const nav = canAccessAdmin ? [...NAV, { href: "/dashboard/admin", label: "Admin", icon: "AD" }] : NAV;
  const inSetupPreview = searchParams.get("fromSetup") === "1";

  useEffect(() => {
    const persisted = typeof window !== "undefined" ? window.localStorage.getItem(SIDEBAR_STORAGE_KEY) : null;
    if (persisted === "1") setCollapsed(true);
  }, []);

  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.json())
      .then(s => {
        if (s.restaurantName) setRestaurantName(s.restaurantName);
        const setupDone = s.setupWizardCompleted === "true";
        if (!canAccessAdmin && !setupDone && pathname !== "/dashboard/setup" && !inSetupPreview) {
          router.replace("/dashboard/setup");
        }
      })
      .catch(() => {});
  }, [canAccessAdmin, inSetupPreview, pathname, router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === href;
    return pathname?.startsWith(href);
  }

  function toggleCollapsed() {
    setCollapsed(prev => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
      }
      return next;
    });
  }

  return (
    <>
      <div className="md:hidden sticky top-0 z-40 h-14 bg-white border-b px-4 flex items-center justify-between">
        <button
          onClick={() => setMobileOpen(true)}
          className="h-10 w-10 rounded-lg border border-gray-200 flex items-center justify-center transition-all duration-200"
          aria-label="Open menu"
        >
          <span className="block w-5 h-0.5 bg-gray-800" />
          <span className="block w-5 h-0.5 bg-gray-800 mt-1" />
          <span className="block w-5 h-0.5 bg-gray-800 mt-1" />
        </button>
        <div className="font-semibold truncate max-w-[70%]">{restaurantName}</div>
        <button
          onClick={logout}
          className="h-10 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 transition-all duration-200"
        >
          Logout
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl p-4 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="font-bold text-lg truncate">{restaurantName}</div>
              <button onClick={() => setMobileOpen(false)} className="h-10 w-10 rounded-lg border border-gray-200">✕</button>
            </div>
            <div className="flex-1 space-y-1 overflow-auto">
              {nav.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`h-11 px-3 rounded-lg flex items-center gap-3 text-sm font-medium transition-all duration-200 ${isActive(item.href) ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:text-blue-600 hover:bg-gray-50"}`}
                >
                  <span className="w-7 h-7 rounded bg-gray-100 text-gray-600 text-[11px] font-semibold flex items-center justify-center">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
            <div className="pt-4 border-t">
              <div className="text-xs text-gray-500 mb-2 truncate">{email}</div>
              <button onClick={logout} className="h-11 w-full rounded-lg bg-gray-900 text-white text-sm transition-all duration-200">Logout</button>
            </div>
          </div>
        </div>
      )}

      <aside className={`hidden md:flex md:flex-col border-r border-gray-200 bg-white transition-all duration-200 ${collapsed ? "w-20" : "w-72"}`}>
        <div className={`h-16 border-b border-gray-200 px-3 ${collapsed ? "justify-center" : "justify-between"} flex items-center`}>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-bold truncate">{restaurantName}</div>
              <div className="text-xs text-gray-500">Dashboard</div>
            </div>
          )}
          <button
            onClick={toggleCollapsed}
            className="h-9 w-9 rounded-lg border border-gray-200 text-sm text-gray-700 transition-all duration-200"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? "→" : "←"}
          </button>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-auto">
          {nav.map(item => (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`h-11 rounded-lg flex items-center transition-all duration-200 ${collapsed ? "justify-center" : "px-3 gap-3"} ${isActive(item.href) ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:text-blue-700 hover:bg-gray-50"}`}
            >
              <span className={`w-7 h-7 rounded text-[11px] font-semibold flex items-center justify-center ${isActive(item.href) ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                {item.icon}
              </span>
              {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="border-t border-gray-200 p-2 space-y-2">
          {!collapsed && <div className="text-xs text-gray-500 truncate px-2">{email}</div>}
          <button
            onClick={logout}
            title={collapsed ? "Logout" : undefined}
            className={`h-10 rounded-lg border border-gray-200 text-gray-700 text-sm transition-all duration-200 ${collapsed ? "w-full" : "w-full"}`}
          >
            {collapsed ? "⎋" : "Logout"}
          </button>
        </div>
      </aside>
    </>
  );
}
