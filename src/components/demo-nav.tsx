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

  useEffect(() => {
    if (!isDemoHost) return;

    document.body.classList.add("demo-nav-mobile-pad");
    return () => {
      document.body.classList.remove("demo-nav-mobile-pad");
    };
  }, [isDemoHost]);

  if (!isDemoHost) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-20 sm:px-0 sm:pb-0">
      <nav className="pointer-events-auto mx-auto max-w-2xl rounded-2xl border border-amber-200/90 bg-amber-50/95 p-1 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-amber-50/80 sm:mx-0">
        <ul className="grid grid-cols-5 gap-1 sm:flex sm:flex-wrap sm:gap-1">
          {DEMO_LINKS.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex min-h-11 min-w-0 flex-col items-center justify-center rounded-xl px-2 py-1 text-[11px] font-medium leading-tight transition-colors sm:h-10 sm:flex-row sm:gap-1.5 sm:px-3 sm:text-xs ${
                    active
                      ? "bg-amber-200 text-amber-900"
                      : "text-amber-900/80 hover:bg-amber-100"
                  }`}
                >
                  <span className="text-base sm:text-sm" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
