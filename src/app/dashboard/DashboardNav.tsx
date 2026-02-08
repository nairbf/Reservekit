"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/dashboard", label: "Inbox" },
  { href: "/dashboard/tonight", label: "Tonight" },
  { href: "/dashboard/tables", label: "Tables" },
  { href: "/dashboard/floorplan", label: "Floor Plan" },
  { href: "/dashboard/schedule", label: "Schedule" },
  { href: "/dashboard/reports", label: "Reports" },
  { href: "/dashboard/guests", label: "Guests" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default function DashboardNav({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [restaurantName, setRestaurantName] = useState("ReserveKit");
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.json())
      .then(s => { if (s.restaurantName) setRestaurantName(s.restaurantName); })
      .catch(() => {});
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === href;
    return pathname?.startsWith(href);
  }

  return (
    <nav className="bg-white shadow-sm border-b sticky top-0 z-40">
      <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOpen(true)}
            className="md:hidden h-11 w-11 rounded-lg border border-gray-200 flex items-center justify-center transition-all duration-200"
            aria-label="Open menu"
          >
            <span className="block w-5 h-0.5 bg-gray-800" />
            <span className="block w-5 h-0.5 bg-gray-800 mt-1" />
            <span className="block w-5 h-0.5 bg-gray-800 mt-1" />
          </button>
          <div className="font-bold text-lg whitespace-nowrap">{restaurantName}</div>
        </div>

        <div className="hidden md:flex items-center gap-1">
          {NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`h-11 px-3 rounded-lg text-sm font-medium flex items-center transition-all duration-200 ${isActive(item.href) ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:text-blue-600"}`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3 text-sm">
          <span className="text-gray-500">{email}</span>
          <button onClick={logout} className="h-11 px-3 rounded-lg border border-gray-200 text-gray-700 hover:border-gray-300 transition-all duration-200">Logout</button>
        </div>
      </div>

      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl p-4 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="font-bold text-lg">{restaurantName}</div>
              <button onClick={() => setOpen(false)} className="h-11 w-11 rounded-lg border border-gray-200">✕</button>
            </div>
            <div className="flex-1 space-y-1">
              {NAV.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`h-11 px-3 rounded-lg flex items-center text-sm font-medium transition-all duration-200 ${isActive(item.href) ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:text-blue-600"}`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="pt-4 border-t text-sm">
              <div className="text-gray-500 mb-2">{email}</div>
              <button onClick={logout} className="h-11 w-full rounded-lg bg-gray-900 text-white transition-all duration-200">Logout</button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
