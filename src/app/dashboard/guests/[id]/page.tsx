"use client";

import { useParams } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

interface GuestReservation {
  id: number;
  date: string;
  time: string;
  partySize: number;
  status: string;
  code: string;
  table: { id: number; name: string } | null;
}

interface GuestEventTicket {
  id: number;
  eventId: number;
  guestName: string;
  guestEmail: string;
  quantity: number;
  totalPaid: number;
  status: string;
  code: string;
  createdAt: string;
  checkedInAt: string | null;
  event: {
    id: number;
    name: string;
    date: string;
    startTime: string;
  };
}

interface GuestPreOrder {
  id: number;
  status: string;
  subtotal: number;
  createdAt: string;
  reservation: {
    id: number;
    date: string;
    time: string;
    code: string;
    status: string;
  };
  items: Array<{
    id: number;
    quantity: number;
    price: number;
    guestLabel: string;
    menuItem: {
      id: number;
      name: string;
    };
  }>;
}

interface GuestDetail {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  vipStatus: string | null;
  dietaryNotes: string | null;
  allergyNotes: string | null;
  generalNotes: string | null;
  tags: string | null;
  totalVisits: number;
  totalNoShows: number;
  totalCovers: number;
  firstVisitDate: string | null;
  lastVisitDate: string | null;
  reservations: GuestReservation[];
  eventTickets: GuestEventTicket[];
  preOrders: GuestPreOrder[];
}

type SectionKey = "info" | "notes" | "reservations" | "events" | "preorders";

function formatTime12(value: string): string {
  const match = (value || "").trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return value;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return value;
  const h = hour % 12 || 12;
  return `${h}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents || 0) / 100);
}

function Section({
  id,
  title,
  mobile,
  open,
  onToggle,
  children,
}: {
  id: SectionKey;
  title: string;
  mobile: boolean;
  open: boolean;
  onToggle: (key: SectionKey) => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-6">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        {mobile ? (
          <button
            onClick={() => onToggle(id)}
            className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600"
          >
            {open ? "Collapse" : "Expand"}
          </button>
        ) : null}
      </div>
      {open ? <div className="p-4 sm:p-6">{children}</div> : null}
    </div>
  );
}

export default function GuestDetailPage() {
  const params = useParams<{ id: string }>();
  const guestId = Number(params.id);

  const [licenseOk, setLicenseOk] = useState<boolean | null>(null);
  const [guest, setGuest] = useState<GuestDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    info: true,
    notes: true,
    reservations: true,
    events: true,
    preorders: true,
  });

  useEffect(() => {
    fetch("/api/settings/public")
      .then(r => r.json())
      .then((s) => setLicenseOk(s.feature_guest_history === "true"))
      .catch(() => setLicenseOk(false));
  }, []);

  useEffect(() => {
    function syncSize() {
      if (typeof window === "undefined") return;
      setIsMobile(window.innerWidth < 640);
    }
    syncSize();
    window.addEventListener("resize", syncSize);
    return () => window.removeEventListener("resize", syncSize);
  }, []);

  useEffect(() => {
    if (licenseOk !== true || !guestId) return;
    setLoading(true);
    fetch(`/api/guests/${guestId}`)
      .then(r => r.json())
      .then(data => setGuest(data))
      .finally(() => setLoading(false));
  }, [guestId, licenseOk]);

  function setField<K extends keyof GuestDetail>(key: K, value: GuestDetail[K]) {
    setGuest(prev => (prev ? { ...prev, [key]: value } : prev));
  }

  async function saveProfile() {
    if (!guest) return;
    setSaving(true);
    await fetch(`/api/guests/${guest.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: guest.name,
        email: guest.email,
        vipStatus: guest.vipStatus,
        dietaryNotes: guest.dietaryNotes,
        allergyNotes: guest.allergyNotes,
        generalNotes: guest.generalNotes,
        tags: guest.tags,
      }),
    });
    setSaving(false);
  }

  async function addNote() {
    const note = noteText.trim();
    if (!note || !guest) return;
    await fetch(`/api/guests/${guest.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    setNoteText("");
    const refreshed = await fetch(`/api/guests/${guest.id}`).then(r => r.json());
    setGuest(refreshed);
  }

  function toggleSection(section: SectionKey) {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  }

  if (licenseOk === null) {
    return (
      <div className="flex items-center gap-3 text-slate-500">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        Checking license...
      </div>
    );
  }

  if (licenseOk === false) {
    return (
      <div className="max-w-3xl">
        <h1 className="mb-4 text-2xl font-bold">Guest History</h1>
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-slate-600">Feature not available for your current plan. Contact support to enable Guest History.</p>
        </div>
      </div>
    );
  }

  if (loading || !guest) {
    return (
      <div className="flex items-center gap-3 text-slate-500">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        Loading guest profile...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{guest.name}</h1>
            <p className="text-sm text-slate-600">{guest.phone}</p>
          </div>
          <button
            onClick={saveProfile}
            className="h-11 w-full rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-all duration-200 sm:w-auto"
          >
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="text-2xl font-bold">{guest.totalVisits}</div><div className="text-xs text-slate-500">Visits</div></div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="text-2xl font-bold">{guest.totalCovers}</div><div className="text-xs text-slate-500">Total covers</div></div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="text-2xl font-bold">{guest.totalNoShows}</div><div className="text-xs text-slate-500">No-shows</div></div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="text-sm font-bold">{guest.firstVisitDate || "N/A"}</div><div className="text-xs text-slate-500">First visit</div></div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="text-sm font-bold">{guest.lastVisitDate || "N/A"}</div><div className="text-xs text-slate-500">Last visit</div></div>
        </div>
      </div>

      <Section id="info" title="Guest Info" mobile={isMobile} open={!isMobile || openSections.info} onToggle={toggleSection}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="text-sm font-medium">Email
            <input
              value={guest.email || ""}
              onChange={event => setField("email", event.target.value || null)}
              className="mt-1 h-11 w-full rounded border border-slate-300 px-3"
            />
          </label>
          <label className="text-sm font-medium">VIP Status
            <select
              value={guest.vipStatus || "regular"}
              onChange={event => setField("vipStatus", event.target.value)}
              className="mt-1 h-11 w-full rounded border border-slate-300 px-3"
            >
              <option value="regular">regular</option>
              <option value="vip">vip</option>
              <option value="blacklist">blacklist</option>
            </select>
          </label>
          <label className="text-sm font-medium">Tags
            <input
              value={guest.tags || ""}
              onChange={event => setField("tags", event.target.value || null)}
              placeholder="birthday regular, window seat"
              className="mt-1 h-11 w-full rounded border border-slate-300 px-3"
            />
          </label>
        </div>
      </Section>

      <Section id="notes" title="Notes" mobile={isMobile} open={!isMobile || openSections.notes} onToggle={toggleSection}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">Dietary Notes
              <textarea
                value={guest.dietaryNotes || ""}
                onChange={event => setField("dietaryNotes", event.target.value || null)}
                rows={4}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm font-medium">Allergy Notes
              <textarea
                value={guest.allergyNotes || ""}
                onChange={event => setField("allergyNotes", event.target.value || null)}
                rows={4}
                className="mt-1 w-full rounded border border-rose-300 bg-rose-50 px-3 py-2"
              />
            </label>
          </div>
          <label className="block text-sm font-medium">General Notes
            <textarea
              value={guest.generalNotes || ""}
              onChange={event => setField("generalNotes", event.target.value || null)}
              rows={6}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={noteText}
              onChange={event => setNoteText(event.target.value)}
              placeholder="Add timestamped staff note"
              className="h-11 flex-1 rounded border border-slate-300 px-3"
            />
            <button
              onClick={addNote}
              className="h-11 w-full rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition-all sm:w-auto"
            >
              Add Note
            </button>
          </div>
        </div>
      </Section>

      <Section id="reservations" title="Reservation History" mobile={isMobile} open={!isMobile || openSections.reservations} onToggle={toggleSection}>
        <div className="max-h-96 overflow-auto rounded-lg border border-slate-200">
          {guest.reservations.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">No reservations yet.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {guest.reservations.map(reservation => (
                <div key={reservation.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                  <div>
                    <div className="font-medium text-slate-900">{reservation.date} at {formatTime12(reservation.time)}</div>
                    <div className="text-slate-500">Party {reservation.partySize} · {reservation.status.replace(/_/g, " ")} · {reservation.code}</div>
                  </div>
                  <div className="text-xs text-slate-500">{reservation.table?.name || "No table"}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      <Section id="events" title="Event Ticket History" mobile={isMobile} open={!isMobile || openSections.events} onToggle={toggleSection}>
        {guest.eventTickets.length === 0 ? (
          <p className="text-sm text-slate-500">No event ticket purchases found for this guest.</p>
        ) : (
          <div className="space-y-3">
            {guest.eventTickets.map(ticket => (
              <div key={ticket.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-slate-900">{ticket.event.name}</div>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${ticket.status === "checked_in" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>
                    {ticket.status.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  {ticket.event.date} at {formatTime12(ticket.event.startTime)} · Qty {ticket.quantity} · {formatCurrency(ticket.totalPaid)}
                </div>
                <div className="mt-1 text-xs text-slate-500">Ticket code: {ticket.code}</div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section id="preorders" title="Pre-Order History" mobile={isMobile} open={!isMobile || openSections.preorders} onToggle={toggleSection}>
        {guest.preOrders.length === 0 ? (
          <p className="text-sm text-slate-500">No pre-orders linked to this guest yet.</p>
        ) : (
          <div className="space-y-3">
            {guest.preOrders.map(order => (
              <div key={order.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-slate-900">
                    {order.reservation.date} at {formatTime12(order.reservation.time)}
                  </div>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700">{order.status}</span>
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  Reservation {order.reservation.code} · {formatCurrency(order.subtotal)}
                </div>
                <div className="mt-2 space-y-1 text-xs text-slate-500">
                  {order.items.map(item => (
                    <div key={item.id}>
                      {item.quantity}x {item.menuItem.name}
                      {item.guestLabel ? ` (${item.guestLabel})` : ""}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
