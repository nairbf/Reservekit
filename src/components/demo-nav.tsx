"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const DEMO_LINKS = [
  { label: "Dashboard", href: "/dashboard", icon: "📊" },
  { label: "Reserve", href: "/reserve/demo", icon: "📅" },
  { label: "Menu", href: "/menu", icon: "🍽️" },
  { label: "Events", href: "/events", icon: "🎉" },
  { label: "Tonight", href: "/dashboard/tonight", icon: "🌙" },
] as const;

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DemoNav() {
  const pathname = usePathname();
  const [isDemoHost, setIsDemoHost] = useState(false);

  useEffect(() => {
    setIsDemoHost(window.location.hostname.includes("demo.reservesit.com"));
  }, []);

  if (!isDemoHost) return null;

  return (
    <div className="border-b border-slate-200 bg-slate-50">
      <div className="mx-auto w-full max-w-6xl overflow-x-auto px-4 sm:px-6">
        <nav className="flex min-w-max items-center justify-center gap-2 py-2">
          {DEMO_LINKS.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-semibold transition-colors ${
                  active
                    ? "bg-blue-100 text-blue-700"
                    : "text-slate-700 hover:bg-slate-200"
                }`}
              >
                <span aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
