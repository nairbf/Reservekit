"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AccessDenied from "@/components/access-denied";
import { useHasPermission } from "@/hooks/use-permissions";

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
  createdAt: string;
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

type CategoryKey = "starter" | "main" | "side" | "dessert" | "drink" | "other";

const CATEGORY_GROUPS: Array<{ key: CategoryKey; label: string }> = [
  { key: "starter", label: "STARTERS" },
  { key: "main", label: "MAINS" },
  { key: "side", label: "SIDES" },
  { key: "dessert", label: "DESSERTS" },
  { key: "drink", label: "DRINKS" },
  { key: "other", label: "OTHER" },
];

function formatCents(cents: number): string {
  return `$${(Math.max(0, Math.trunc(cents)) / 100).toFixed(2)}`;
}

function parseTimeParts(value: string): { hour: number; minute: number; second: number } | null {
  const match = (value || "").trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || "0");
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || !Number.isFinite(second)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return null;
  return { hour, minute, second };
}

function normalizeTimeKey(value: string): string {
  const parts = parseTimeParts(value);
  if (!parts) return value;
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

function formatTime12(value: string): string {
  const parts = parseTimeParts(value);
  if (!parts) return value;
  const h = parts.hour % 12 || 12;
  return `${h}:${String(parts.minute).padStart(2, "0")} ${parts.hour >= 12 ? "PM" : "AM"}`;
}

function minutesUntil(date: string, time: string): number {
  const parts = parseTimeParts(time);
  if (!parts) return 0;
  const dt = new Date(`${date}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}:${String(parts.second).padStart(2, "0")}`);
  if (Number.isNaN(dt.getTime())) return 0;
  return Math.round((dt.getTime() - Date.now()) / 60000);
}

function minutesSince(value: string): number | null {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return Math.max(0, Math.round((Date.now() - dt.getTime()) / 60000));
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

function categoryForItem(item: PreOrderItem): CategoryKey {
  const type = String(item.menuItem.category?.type || "other").toLowerCase();
  if (type === "starter" || type === "main" || type === "side" || type === "dessert" || type === "drink") return type;
  return "other";
}

function groupItemsByCategory(items: PreOrderItem[]) {
  const grouped: Record<CategoryKey, PreOrderItem[]> = {
    starter: [],
    main: [],
    side: [],
    dessert: [],
    drink: [],
    other: [],
  };
  for (const item of items) {
    grouped[categoryForItem(item)].push(item);
  }
  return CATEGORY_GROUPS
    .map(group => ({ ...group, items: grouped[group.key] }))
    .filter(group => group.items.length > 0);
}

function cardToneForStatus(status: string): string {
  if (status === "confirmed_by_staff") return "bg-blue-50 border-blue-300";
  if (status === "preparing") return "bg-yellow-50 border-yellow-300";
  if (status === "ready") return "bg-green-50 border-green-300";
  if (status === "completed") return "bg-gray-50 border-gray-300 opacity-80";
  return "bg-white border-gray-200";
}

function statusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

function orderAgeTone(minutes: number | null): string {
  if (minutes === null) return "bg-gray-100 text-gray-700 border-gray-200";
  if (minutes < 15) return "bg-emerald-100 text-emerald-800 border-emerald-300";
  if (minutes <= 30) return "bg-yellow-100 text-yellow-800 border-yellow-300";
  return "bg-orange-100 text-orange-800 border-orange-300";
}

function nextWorkflowAction(status: string): { action: string; label: string } | null {
  if (status === "submitted" || status === "confirmed_by_staff") return { action: "start_preparing", label: "Start Preparing" };
  if (status === "preparing") return { action: "mark_ready", label: "Mark Ready" };
  if (status === "ready") return { action: "complete", label: "Complete" };
  return null;
}

export default function KitchenPage() {
  const canManageMenu = useHasPermission("manage_menu");
  const [mode, setMode] = useState<"tonight" | "tomorrow">("tonight");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [licensed, setLicensed] = useState<boolean | null>(null);
  const [timezone, setTimezone] = useState("America/New_York");
  const [actioning, setActioning] = useState<Record<number, string>>({});

  const load = useCallback(async (silent = false) => {
    if (licensed === false) {
      setLoading(false);
      return;
    }
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const date = dateInTimezone(timezone, mode === "tomorrow" ? 1 : 0);
      const response = await fetch(`/api/reservations?status=all&date=${date}`);
      const data = await response.json();
      const list = Array.isArray(data) ? data as Reservation[] : [];
      setReservations(list.filter(item => item.preOrder && item.preOrder.status !== "cancelled"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [mode, licensed, timezone]);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings/public").then(r => r.json()),
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
    void load(false);
    const timer = setInterval(() => {
      void load(true);
    }, 30000);
    return () => clearInterval(timer);
  }, [load, licensed]);

  async function runAction(preOrderId: number, action: string) {
    setActioning(prev => ({ ...prev, [preOrderId]: action }));
    try {
      const response = await fetch(`/api/preorder/${preOrderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        alert(body.error || "Action failed");
        return;
      }
      await load(true);
    } finally {
      setActioning(prev => {
        const next = { ...prev };
        delete next[preOrderId];
        return next;
      });
    }
  }

  const groupedByTime = useMemo(() => {
    const map: Record<string, Reservation[]> = {};
    for (const reservation of reservations) {
      const key = normalizeTimeKey(reservation.time);
      if (!map[key]) map[key] = [];
      map[key].push(reservation);
    }
    return map;
  }, [reservations]);

  const times = useMemo(
    () => Object.keys(groupedByTime).sort((a, b) => {
      const aParts = parseTimeParts(a);
      const bParts = parseTimeParts(b);
      if (!aParts || !bParts) return a.localeCompare(b);
      return (aParts.hour * 3600 + aParts.minute * 60 + aParts.second) - (bParts.hour * 3600 + bParts.minute * 60 + bParts.second);
    }),
    [groupedByTime],
  );

  const aggregate = useMemo(() => {
    const grouped: Record<CategoryKey, Map<string, number>> = {
      starter: new Map(),
      main: new Map(),
      side: new Map(),
      dessert: new Map(),
      drink: new Map(),
      other: new Map(),
    };
    for (const reservation of reservations) {
      for (const item of reservation.preOrder?.items || []) {
        const key = item.menuItem.name;
        const category = categoryForItem(item);
        grouped[category].set(key, (grouped[category].get(key) || 0) + item.quantity);
      }
    }
    return CATEGORY_GROUPS
      .map(group => ({
        ...group,
        items: Array.from(grouped[group.key].entries()).sort((a, b) => b[1] - a[1]),
      }))
      .filter(group => group.items.length > 0);
  }, [reservations]);

  if (!canManageMenu) return <AccessDenied />;

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-gray-500">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        Loading kitchen prep...
      </div>
    );
  }

  if (licensed === false) {
    return (
      <div className="max-w-3xl">
        <h1 className="mb-4 text-2xl font-bold">Kitchen</h1>
        <div className="rounded-xl bg-white p-6 shadow">
          <p className="mb-4 text-gray-600">Express Dining is a paid add-on.</p>
          <a href="/#pricing" className="inline-flex h-11 items-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-all duration-200">Upgrade to Unlock</a>
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
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setMode("tonight")}
            className={`h-11 rounded-lg border px-4 ${mode === "tonight" ? "border-blue-600 bg-blue-600 text-white" : "border-gray-200 bg-white text-gray-700"}`}
          >
            Tonight
          </button>
          <button
            onClick={() => setMode("tomorrow")}
            className={`h-11 rounded-lg border px-4 ${mode === "tomorrow" ? "border-blue-600 bg-blue-600 text-white" : "border-gray-200 bg-white text-gray-700"}`}
          >
            Tomorrow
          </button>
          <button
            onClick={() => void load(true)}
            className="h-11 rounded-lg border border-gray-200 bg-white px-4 text-gray-700"
          >
            Refresh
          </button>
          <button
            onClick={() => window.print()}
            className="h-11 rounded-lg border border-gray-200 bg-white px-4 text-gray-700"
          >
            Print
          </button>
        </div>
      </div>

      <div className="no-print flex items-center gap-2 text-xs text-gray-500">
        <span>Auto-refreshes every 30s</span>
        {refreshing ? <span>• Refreshing…</span> : null}
      </div>

      <div className="rounded-xl bg-white p-3 shadow sm:p-5">
        <h2 className="mb-3 font-semibold">Bulk prep summary</h2>
        {aggregate.length === 0 ? (
          <p className="text-sm text-gray-500">No pre-orders for this window.</p>
        ) : (
          <div className="space-y-3">
            {aggregate.map(group => (
              <div key={group.key}>
                <h3 className="mb-1 text-xs font-semibold text-gray-600">{group.label}</h3>
                <div className="flex flex-wrap gap-2">
                  {group.items.slice(0, 24).map(([name, count]) => (
                    <span key={`${group.key}-${name}`} className="rounded-full border bg-gray-50 px-2 py-1 text-xs">
                      {count}x {name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {times.map(time => (
          <section key={time}>
            <h3 className="mb-2 text-lg font-bold">{formatTime12(time)}</h3>
            <div className="space-y-3">
              {groupedByTime[time].map(reservation => {
                const preOrder = reservation.preOrder!;
                const categoryGroups = groupItemsByCategory(preOrder.items);
                const byGuest = preOrder.items.reduce<Record<string, PreOrderItem[]>>((acc, item) => {
                  if (!acc[item.guestLabel]) acc[item.guestLabel] = [];
                  acc[item.guestLabel].push(item);
                  return acc;
                }, {});
                const workflow = nextWorkflowAction(preOrder.status);
                const ageMinutes = minutesSince(preOrder.createdAt);
                const serviceInMinutes = minutesUntil(reservation.date, reservation.time);
                const actionState = actioning[preOrder.id];
                return (
                  <article key={reservation.id} className={`rounded-xl border p-3 sm:p-5 ${cardToneForStatus(preOrder.status)}`}>
                    <div className="mb-3 border-b pb-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-semibold">TABLE: {reservation.table?.name || "unassigned"}</div>
                        <span className={`rounded-full border px-2 py-1 text-xs font-medium ${orderAgeTone(ageMinutes)}`}>
                          Ordered {ageMinutes !== null ? `${ageMinutes} min ago` : "time unknown"}
                        </span>
                      </div>
                      <div className="text-sm sm:text-base">
                        PARTY: {reservation.guestName} ({reservation.partySize} guests) - {formatTime12(reservation.time)}
                      </div>
                      <div className="text-xs text-gray-600">
                        STATUS: {reservation.status.replaceAll("_", " ")} · PREORDER: {statusLabel(preOrder.status)}
                        {serviceInMinutes >= 0 ? ` · service in ${serviceInMinutes}m` : ` · service started ${Math.abs(serviceInMinutes)}m ago`}
                      </div>
                    </div>

                    <div className="space-y-3 text-sm sm:text-base">
                      {categoryGroups.map(group => (
                        <div key={`${preOrder.id}-${group.key}`}>
                          <div className="font-semibold">{group.label}:</div>
                          <ul className="list-disc pl-5 text-sm sm:text-base">
                            {group.items.map(item => (
                              <li key={item.id}>
                                {item.quantity}x {item.menuItem.name}
                                {item.specialInstructions ? ` (${item.specialInstructions})` : ""}
                                {String(item.menuItem.dietaryTags || "").includes("N") ? " ⚠" : ""}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}

                      {Object.keys(byGuest).length > 1 ? (
                        <details>
                          <summary className="cursor-pointer text-xs text-gray-600">Per guest breakdown</summary>
                          {Object.entries(byGuest).map(([guestLabel, items]) => (
                            <div key={guestLabel}>
                              <div className="font-medium">{guestLabel}:</div>
                              <ul className="list-disc pl-5 text-sm sm:text-base">
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
                      ) : null}
                    </div>

                    {preOrder.specialNotes ? (
                      <div className="mt-3 text-sm sm:text-base">
                        <span className="font-medium">NOTES:</span> {preOrder.specialNotes}
                      </div>
                    ) : null}

                    <div className="mt-2 text-sm sm:text-base">
                      <span className="font-medium">PAID:</span> {preOrder.isPaid ? `${formatCents(preOrder.subtotal)} ✓` : "No"}
                    </div>

                    <div className="no-print mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      {workflow ? (
                        <button
                          onClick={() => void runAction(preOrder.id, workflow.action)}
                          disabled={Boolean(actionState)}
                          className="h-11 w-full rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition-all duration-200 disabled:opacity-60 sm:w-auto"
                        >
                          {actionState === workflow.action ? "Updating..." : workflow.label}
                        </button>
                      ) : null}

                      {!preOrder.isPaid && preOrder.subtotal > 0 ? (
                        <button
                          onClick={() => void runAction(preOrder.id, "mark_paid")}
                          disabled={Boolean(actionState)}
                          className="h-11 w-full rounded-lg border border-emerald-300 bg-emerald-50 px-4 text-sm font-medium text-emerald-800 transition-all duration-200 disabled:opacity-60 sm:w-auto"
                        >
                          {actionState === "mark_paid" ? "Updating..." : "Mark Paid"}
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {times.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center text-gray-500 shadow">
          No pre-orders found for {mode}.
        </div>
      ) : null}
    </div>
  );
}
