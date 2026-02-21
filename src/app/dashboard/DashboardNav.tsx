"use client";

import Link from "next/link";
import { Menu, PanelLeftClose } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { PermissionKey } from "@/lib/permissions";

const NAV = [
  { href: "/dashboard", label: "Inbox", icon: "IN", permission: "view_dashboard" },
  { href: "/dashboard/tonight", label: "Tonight", icon: "TN", permission: "tonight_view" },
  { href: "/dashboard/kitchen", label: "Kitchen", icon: "KT", permission: "manage_menu" },
  { href: "/dashboard/waitlist", label: "Waitlist", icon: "WL", permission: "manage_waitlist" },
  { href: "/dashboard/tables", label: "Tables", icon: "TB", permission: "manage_tables" },
  { href: "/dashboard/floorplan", label: "Floor Plan", icon: "FP", feature: "floorplan", permission: "manage_tables" },
  { href: "/dashboard/schedule", label: "Schedule", icon: "SC", permission: "manage_schedule" },
  { href: "/dashboard/reports", label: "Reports", icon: "RP", feature: "reporting", permission: "view_reports" },
  { href: "/dashboard/events", label: "Events", icon: "EV", feature: "event_ticketing", permission: "manage_events" },
  { href: "/dashboard/menu", label: "Menu", icon: "MN", permission: "manage_menu" },
  { href: "/dashboard/guests", label: "Guests", icon: "GS", feature: "guest_history", permission: "view_guests" },
  { href: "/dashboard/settings", label: "Settings", icon: "ST", permission: "manage_settings" },
  { href: "/dashboard/admin", label: "Admin", icon: "AD", permission: "manage_staff" },
];

const SIDEBAR_STORAGE_KEY = "dashboardSidebarCollapsed";

type DashboardFeatures = Record<string, boolean>;

export default function DashboardNav({
  email,
  canAccessAdmin,
  permissions,
  features,
}: {
  email: string;
  canAccessAdmin: boolean;
  permissions: string[];
  features: DashboardFeatures;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [tabletMode, setTabletMode] = useState(false);
  const [tabletHover, setTabletHover] = useState(false);
  const [restaurantName, setRestaurantName] = useState("ReserveSit");

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const permissionSet = useMemo(() => new Set(permissions as PermissionKey[]), [permissions]);

  const nav = NAV.filter((item) => {
    if (!("feature" in item) || !item.feature) return true;
    return features[item.feature as keyof DashboardFeatures] === true;
  }).filter((item) => {
    if (item.href === "/dashboard/admin" && !canAccessAdmin) return false;
    return permissionSet.has(item.permission as PermissionKey);
  });
  const inSetupPreview = searchParams.get("fromSetup") === "1";

  useEffect(() => {
    const persisted = typeof window !== "undefined" ? window.localStorage.getItem(SIDEBAR_STORAGE_KEY) : null;
    if (persisted === "1") setCollapsed(true);
  }, []);

  useEffect(() => {
    function syncTabletMode() {
      if (typeof window === "undefined") return;
      const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
      setTabletMode(isTablet);
      if (!isTablet) setTabletHover(false);
    }
    syncTabletMode();
    window.addEventListener("resize", syncTabletMode);
    return () => window.removeEventListener("resize", syncTabletMode);
  }, []);

  useEffect(() => {
    fetch("/api/settings/public")
      .then(r => r.json())
      .then(s => {
        if (s.restaurantName) setRestaurantName(s.restaurantName);
        const setupDone = s.setupWizardCompleted === "true";
        if (!setupDone && pathname !== "/dashboard/setup" && !inSetupPreview) {
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

  const effectiveCollapsed = tabletMode ? !tabletHover : collapsed;

  return (
    <>
      <div className="md:hidden sticky top-0 z-40 h-14 bg-white border-b px-4 flex items-center justify-between">
        <button
          onClick={() => setMobileOpen(true)}
          className="h-10 w-10 rounded-lg border border-gray-200 flex items-center justify-center transition-all duration-200"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5 text-gray-800" />
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
                  onClick={() => setMobileOpen(false)}
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

      <aside
        onMouseEnter={() => {
          if (tabletMode) setTabletHover(true);
        }}
        onMouseLeave={() => {
          if (tabletMode) setTabletHover(false);
        }}
        className={`hidden md:flex md:flex-col border-r border-gray-200 bg-white transition-all duration-200 ${effectiveCollapsed ? "w-20" : "w-72"}`}
      >
        <div className={`h-16 border-b border-gray-200 px-3 ${effectiveCollapsed ? "justify-center" : "justify-between"} flex items-center`}>
          {!effectiveCollapsed && (
            <div className="min-w-0">
              <div className="font-bold truncate">{restaurantName}</div>
              <div className="text-xs text-gray-500">Dashboard</div>
            </div>
          )}
          {!tabletMode && (
            <button
              onClick={toggleCollapsed}
              className="h-9 w-9 rounded-lg border border-gray-200 text-sm text-gray-700 transition-all duration-200 flex items-center justify-center"
              title={effectiveCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {effectiveCollapsed ? <Menu className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          )}
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-auto">
          {nav.map(item => (
            <Link
              key={item.href}
              href={item.href}
              title={effectiveCollapsed ? item.label : undefined}
              className={`h-11 rounded-lg flex items-center transition-all duration-200 ${effectiveCollapsed ? "justify-center" : "px-3 gap-3"} ${isActive(item.href) ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:text-blue-700 hover:bg-gray-50"}`}
            >
              <span className={`w-7 h-7 rounded text-[11px] font-semibold flex items-center justify-center ${isActive(item.href) ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                {item.icon}
              </span>
              {!effectiveCollapsed && <span className="text-sm font-medium">{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="border-t border-gray-200 p-2 space-y-2">
          {!effectiveCollapsed && <div className="text-xs text-gray-500 truncate px-2">{email}</div>}
          <button
            onClick={logout}
            title={effectiveCollapsed ? "Logout" : undefined}
            className="h-10 w-full rounded-lg border border-gray-200 text-gray-700 text-sm transition-all duration-200"
          >
            {effectiveCollapsed ? "⎋" : "Logout"}
          </button>
        </div>
      </aside>
    </>
  );
}
