"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface Guest {
  id: number;
  name: string;
  phone: string;
  vipStatus: string | null;
  totalVisits: number;
  lastVisitDate: string | null;
  totalNoShows: number;
}

function visitSuffix(value: number): string {
  const v = value % 100;
  if (v >= 11 && v <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
}

function styleForGuest(guest: Guest) {
  if (guest.vipStatus === "blacklist") return { card: "border-red-300 bg-red-50", badge: "Blacklist", badgeClass: "bg-red-100 text-red-700" };
  if (guest.vipStatus === "vip") return { card: "border-amber-300 bg-amber-50", badge: "VIP", badgeClass: "bg-amber-100 text-amber-800" };
  if (guest.totalVisits >= 10) return { card: "border-purple-300 bg-purple-50", badge: "VIP", badgeClass: "bg-purple-100 text-purple-700" };
  if (guest.totalVisits >= 6) return { card: "border-amber-300 bg-amber-50", badge: "Regular", badgeClass: "bg-amber-100 text-amber-800" };
  if (guest.totalVisits >= 2) return { card: "border-blue-300 bg-blue-50", badge: "Returning", badgeClass: "bg-blue-100 text-blue-700" };
  return { card: "border-gray-200 bg-white", badge: "New", badgeClass: "bg-gray-100 text-gray-600" };
}

export default function GuestsPage() {
  const [licenseOk, setLicenseOk] = useState<boolean | null>(null);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then(r => r.json()),
      fetch("/api/auth/me").then(r => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([s, session]) => {
        const key = String(s.license_guesthistory || "").toUpperCase();
        const hasKey = /^RS-GST-[A-Z0-9]{8}$/.test(key);
        const isAdmin = session?.role === "admin";
        setLicenseOk(hasKey || isAdmin);
      })
      .catch(() => setLicenseOk(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (licenseOk !== true) return;
    setLoading(true);
    const q = debounced ? `?search=${encodeURIComponent(debounced)}` : "";
    fetch(`/api/guests${q}`)
      .then(r => r.json())
      .then(data => setGuests(data))
      .finally(() => setLoading(false));
  }, [debounced, licenseOk]);

  const total = useMemo(() => guests.length, [guests]);

  if (licenseOk === null) {
    return (
      <div className="flex items-center gap-3 text-gray-500">
        <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
        Checking license...
      </div>
    );
  }

  if (licenseOk === false) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold mb-4">Guest History</h1>
        <div className="bg-white rounded-xl shadow p-6">
          <p className="text-gray-600 mb-4">Guest History is a paid add-on.</p>
          <Link href="/#pricing" className="inline-flex items-center h-11 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium transition-all duration-200">Upgrade to Unlock</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Guests</h1>
          <p className="text-sm text-gray-500">{total} guest profiles</p>
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or phone"
          className="h-11 w-full sm:w-72 border rounded-lg px-3 text-sm"
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-gray-500">
          <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
          Loading guests...
        </div>
      ) : guests.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">No guests found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {guests.map(guest => {
            const style = styleForGuest(guest);
            return (
              <Link
                key={guest.id}
                href={`/dashboard/guests/${guest.id}`}
                className={`block rounded-xl border shadow-sm p-4 sm:p-5 transition-all duration-200 hover:shadow ${style.card}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-bold">{guest.name}</div>
                    <div className="text-sm text-gray-600">{guest.phone}</div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${style.badgeClass}`}>{style.badge}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                  <span>{guest.totalVisits} visit{guest.totalVisits === 1 ? "" : "s"}</span>
                  {guest.totalVisits > 1 && <span className="text-blue-600">↩ {visitSuffix(guest.totalVisits)} visit</span>}
                </div>
                <div className="text-xs text-gray-500 mt-2">Last visit: {guest.lastVisitDate || "N/A"}</div>
                {guest.totalNoShows > 0 && <div className="text-xs text-red-600 mt-1">No-shows: {guest.totalNoShows}</div>}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
