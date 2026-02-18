"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface MenuItem {
  id: number;
  name: string;
  dietaryTags: string | null;
  category?: {
    id: number;
    type: string;
  } | null;
}

interface PreOrderItem {
  id: number;
  guestLabel: string;
  quantity: number;
  specialInstructions: string | null;
  menuItem: MenuItem;
}

interface PreOrder {
  id: number;
  status: string;
  specialNotes: string | null;
  subtotal: number;
  isPaid: boolean;
  items: PreOrderItem[];
}

interface Reservation {
  id: number;
  guestName: string;
  partySize: number;
  date: string;
  time: string;
  status: string;
  table: { id: number; name: string } | null;
  preOrder: PreOrder | null;
}

function formatCents(cents: number): string {
  return `$${(Math.max(0, Math.trunc(cents)) / 100).toFixed(2)}`;
}

function formatTime12(value: string): string {
  const match = (value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return value;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  const h = hour % 12 || 12;
  return `${h}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

function minutesUntil(date: string, time: string): number {
  const dt = new Date(`${date}T${time}:00`);
  return Math.round((dt.getTime() - Date.now()) / 60000);
}

function toneForReservation(res: Reservation): string {
  if (["arrived", "seated"].includes(res.status)) return "bg-green-50 border-green-300";
  if (res.preOrder?.status === "confirmed_by_staff") return "bg-blue-50 border-blue-300";
  const mins = minutesUntil(res.date, res.time);
  if (mins >= 0 && mins <= 30) return "bg-yellow-50 border-yellow-300";
  return "bg-white border-gray-200";
}

function dateInTimezone(timezone: string, dayOffset = 0): string {
  const now = new Date();
  now.setDate(now.getDate() + dayOffset);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone || "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const byType = new Map<string, string>();
  for (const part of parts) byType.set(part.type, part.value);
  const year = byType.get("year") || "1970";
  const month = byType.get("month") || "01";
  const day = byType.get("day") || "01";
  return `${year}-${month}-${day}`;
}

export default function KitchenPage() {
  const [mode, setMode] = useState<"tonight" | "tomorrow">("tonight");
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [licensed, setLicensed] = useState<boolean | null>(null);
  const [timezone, setTimezone] = useState("America/New_York");

  const load = useCallback(async () => {
    if (licensed === false) {
      setLoading(false);
      return;
    }
    const date = dateInTimezone(timezone, mode === "tomorrow" ? 1 : 0);
    const res = await fetch(`/api/reservations?status=all&date=${date}`);
    const data = await res.json();
    const list = Array.isArray(data) ? data as Reservation[] : [];
    setReservations(list.filter(item => item.preOrder && item.preOrder.status !== "cancelled"));
    setLoading(false);
  }, [mode, licensed, timezone]);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then(r => r.json()),
      fetch("/api/auth/me").then(r => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([settings, me]) => {
        setTimezone(String(settings.timezone || "America/New_York"));
        const key = String(settings.license_expressdining || "").toUpperCase();
        const hasKey = /^RS-XDN-[A-Z0-9]{8}$/.test(key);
        const isAdmin = me?.role === "admin" || me?.role === "superadmin";
        setLicensed(hasKey || isAdmin);
      })
      .catch(() => setLicensed(false));
  }, []);

  useEffect(() => {
    if (licensed === null) return;
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load, licensed]);

  const groupedByTime = useMemo(() => {
    const map: Record<string, Reservation[]> = {};
    for (const reservation of reservations) {
      if (!map[reservation.time]) map[reservation.time] = [];
      map[reservation.time].push(reservation);
    }
    return map;
  }, [reservations]);

  const times = useMemo(() => Object.keys(groupedByTime).sort(), [groupedByTime]);

  const aggregate = useMemo(() => {
    const starterCounts = new Map<string, number>();
    const drinkCounts = new Map<string, number>();
    for (const reservation of reservations) {
      for (const item of reservation.preOrder?.items || []) {
        const key = item.menuItem.name;
        const type = String(item.menuItem.category?.type || "starter");
        if (type === "drink") {
          drinkCounts.set(key, (drinkCounts.get(key) || 0) + item.quantity);
        } else {
          starterCounts.set(key, (starterCounts.get(key) || 0) + item.quantity);
        }
      }
    }
    return {
      starters: Array.from(starterCounts.entries()).sort((a, b) => b[1] - a[1]),
      drinks: Array.from(drinkCounts.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [reservations]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-gray-500">
        <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
        Loading kitchen prep...
      </div>
    );
  }

  if (licensed === false) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold mb-4">Kitchen</h1>
        <div className="bg-white rounded-xl shadow p-6">
          <p className="text-gray-600 mb-4">Express Dining is a paid add-on.</p>
          <a href="/#pricing" className="inline-flex items-center h-11 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium transition-all duration-200">Upgrade to Unlock</a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Kitchen Prep</h1>
          <p className="text-sm text-gray-500">Pre-orders grouped by arrival time.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode("tonight")}
            className={`h-11 px-4 rounded-lg border ${mode === "tonight" ? "bg-blue-600 text-white border-blue-600" : "bg-white border-gray-200 text-gray-700"}`}
          >
            Tonight
          </button>
          <button
            onClick={() => setMode("tomorrow")}
            className={`h-11 px-4 rounded-lg border ${mode === "tomorrow" ? "bg-blue-600 text-white border-blue-600" : "bg-white border-gray-200 text-gray-700"}`}
          >
            Tomorrow
          </button>
          <button
            onClick={() => window.print()}
            className="h-11 px-4 rounded-lg border border-gray-200 bg-white text-gray-700"
          >
            Print
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="font-semibold mb-2">Bulk prep summary</h2>
        {aggregate.starters.length === 0 && aggregate.drinks.length === 0 ? (
          <p className="text-sm text-gray-500">No pre-orders for this window.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <h3 className="text-xs font-semibold text-gray-600 mb-1">STARTERS</h3>
              <div className="flex flex-wrap gap-2">
                {aggregate.starters.length === 0 && <span className="text-xs text-gray-500">None</span>}
                {aggregate.starters.slice(0, 24).map(([name, count]) => (
                  <span key={`s-${name}`} className="text-xs px-2 py-1 rounded-full border bg-gray-50">
                    {count}x {name}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-gray-600 mb-1">DRINKS</h3>
              <div className="flex flex-wrap gap-2">
                {aggregate.drinks.length === 0 && <span className="text-xs text-gray-500">None</span>}
                {aggregate.drinks.slice(0, 24).map(([name, count]) => (
                  <span key={`d-${name}`} className="text-xs px-2 py-1 rounded-full border bg-gray-50">
                    {count}x {name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {times.map(time => (
          <section key={time}>
            <h3 className="font-bold text-lg mb-2">{formatTime12(time)}</h3>
            <div className="space-y-3">
              {groupedByTime[time].map(reservation => {
                const preOrder = reservation.preOrder!;
                const starterItems = preOrder.items.filter(item => String(item.menuItem.category?.type || "starter") !== "drink");
                const drinkItems = preOrder.items.filter(item => String(item.menuItem.category?.type || "starter") === "drink");
                const byGuest = preOrder.items.reduce<Record<string, PreOrderItem[]>>((acc, item) => {
                  if (!acc[item.guestLabel]) acc[item.guestLabel] = [];
                  acc[item.guestLabel].push(item);
                  return acc;
                }, {});
                return (
                  <article key={reservation.id} className={`rounded-xl border p-4 ${toneForReservation(reservation)}`}>
                    <div className="border-b pb-2 mb-2">
                      <div className="font-semibold">TABLE: {reservation.table?.name || "unassigned"}</div>
                      <div className="text-sm">
                        PARTY: {reservation.guestName} ({reservation.partySize} guests) - {formatTime12(reservation.time)}
                      </div>
                      <div className="text-xs text-gray-600">
                        STATUS: {reservation.status.replaceAll("_", " ")}
                        {preOrder.status === "confirmed_by_staff" ? " · confirmed by staff ✓" : ""}
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div>
                        <div className="font-semibold">STARTERS:</div>
                        {starterItems.length === 0 ? (
                          <div className="text-gray-500 text-xs">None</div>
                        ) : (
                          <ul className="list-disc pl-5">
                            {starterItems.map(item => (
                              <li key={item.id}>
                                {item.quantity}x {item.menuItem.name}
                                {item.specialInstructions ? ` (${item.specialInstructions})` : ""}
                                {String(item.menuItem.dietaryTags || "").includes("N") ? " ⚠" : ""}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div>
                        <div className="font-semibold">DRINKS:</div>
                        {drinkItems.length === 0 ? (
                          <div className="text-gray-500 text-xs">None</div>
                        ) : (
                          <ul className="list-disc pl-5">
                            {drinkItems.map(item => (
                              <li key={item.id}>
                                {item.quantity}x {item.menuItem.name}
                                {item.specialInstructions ? ` (${item.specialInstructions})` : ""}
                                {String(item.menuItem.dietaryTags || "").includes("N") ? " ⚠" : ""}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      {Object.keys(byGuest).length > 1 && (
                        <details>
                          <summary className="cursor-pointer text-xs text-gray-600">Per guest breakdown</summary>
                          {Object.entries(byGuest).map(([guestLabel, items]) => (
                            <div key={guestLabel}>
                              <div className="font-medium">{guestLabel}:</div>
                              <ul className="list-disc pl-5">
                                {items.map(item => (
                                  <li key={`guest-${item.id}`}>
                                    {item.quantity}x {item.menuItem.name}
                                    {item.specialInstructions ? ` (${item.specialInstructions})` : ""}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </details>
                      )}
                    </div>

                    {preOrder.specialNotes && (
                      <div className="mt-3 text-sm">
                        <span className="font-medium">NOTES:</span> {preOrder.specialNotes}
                      </div>
                    )}
                    <div className="mt-2 text-sm">
                      <span className="font-medium">PAID:</span> {preOrder.isPaid ? `${formatCents(preOrder.subtotal)} ✓` : "No"}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {times.length === 0 && (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
          No pre-orders found for {mode}.
        </div>
      )}
    </div>
  );
}
