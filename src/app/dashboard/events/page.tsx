"use client";
import { useEffect, useMemo, useState } from "react";
import AccessDenied from "@/components/access-denied";
import { useHasPermission } from "@/hooks/use-permissions";
import ResponsiveTable from "@/components/responsive-table";

type TicketStatus = "confirmed" | "checked_in" | "cancelled" | "refunded";

interface EventTicket {
  id: number;
  guestName: string;
  guestEmail: string;
  guestPhone: string | null;
  quantity: number;
  totalPaid: number;
  stripePaymentIntentId: string | null;
  status: TicketStatus | string;
  code: string;
  createdAt: string;
  checkedInAt: string | null;
}

interface EventItem {
  id: number;
  name: string;
  description: string | null;
  date: string;
  startTime: string;
  endTime: string | null;
  ticketPrice: number;
  maxTickets: number;
  soldTickets: number;
  isActive: boolean;
  slug: string;
  imageUrl: string | null;
  actualRevenue?: number;
}

interface EventDetail extends EventItem {
  tickets: EventTicket[];
  remainingTickets: number;
  revenue?: number;
  actualRevenue?: number;
  checkInRate: number;
}

function formatCents(value: number): string {
  return `$${(Math.max(0, Math.trunc(value)) / 100).toFixed(2)}`;
}

function formatTime12(value: string): string {
  const [h, m] = String(value || "00:00").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return value;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function formatDate(value: string): string {
  const dt = new Date(`${value}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function ticketBadge(status: string): string {
  if (status === "checked_in") return "bg-green-100 text-green-700";
  if (status === "cancelled" || status === "refunded") return "bg-gray-100 text-gray-600";
  return "bg-blue-100 text-blue-700";
}

export default function EventsDashboardPage() {
  const canManageEvents = useHasPermission("manage_events");
  const [licensed, setLicensed] = useState<boolean | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [successFlash, setSuccessFlash] = useState("");
  const [ticketQuery, setTicketQuery] = useState("");
  const [copyFlash, setCopyFlash] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [actionLoadingTicketId, setActionLoadingTicketId] = useState<number | null>(null);

  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrTitle, setQrTitle] = useState("");

  if (!canManageEvents) return <AccessDenied />;

  const [createForm, setCreateForm] = useState({
    name: "",
    slug: "",
    description: "",
    imageUrl: "",
    date: "",
    startTime: "18:00",
    endTime: "21:00",
    ticketPriceDollars: "79",
    maxTickets: "40",
  });

  const [editForm, setEditForm] = useState({
    name: "",
    slug: "",
    description: "",
    imageUrl: "",
    date: "",
    startTime: "18:00",
    endTime: "21:00",
    ticketPriceDollars: "0",
    maxTickets: "1",
    isActive: true,
  });

  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    guestName: "",
    guestEmail: "",
    guestPhone: "",
    quantity: "1",
    paid: false,
  });

  async function loadEvents() {
    const res = await fetch("/api/events");
    const data = await res.json();
    const list = Array.isArray(data) ? data as EventItem[] : [];
    setEvents(list);
    if (!selectedId && list.length > 0) setSelectedId(list[0].id);
    return list;
  }

  async function loadSelected(id: number) {
    const res = await fetch(`/api/events/${id}`);
    const data = await res.json();
    if (res.ok) setDetail(data as EventDetail);
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/settings/public").then(r => r.json()),
      loadEvents(),
    ])
      .then(([settings]) => {
        setLicensed(settings.feature_event_ticketing === "true");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    loadSelected(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (!detail) return;
    setEditForm({
      name: detail.name,
      slug: detail.slug,
      description: detail.description || "",
      imageUrl: detail.imageUrl || "",
      date: detail.date,
      startTime: detail.startTime,
      endTime: detail.endTime || "",
      ticketPriceDollars: (detail.ticketPrice / 100).toFixed(2),
      maxTickets: String(detail.maxTickets),
      isActive: detail.isActive,
    });
  }, [detail]);

  useEffect(() => {
    if (!successFlash) return;
    const t = window.setTimeout(() => setSuccessFlash(""), 2200);
    return () => window.clearTimeout(t);
  }, [successFlash]);

  useEffect(() => {
    if (!copyFlash) return;
    const t = window.setTimeout(() => setCopyFlash(""), 1600);
    return () => window.clearTimeout(t);
  }, [copyFlash]);

  const filteredTickets = useMemo(() => {
    if (!detail) return [] as EventTicket[];
    const q = ticketQuery.trim().toLowerCase();
    const base = !q
      ? detail.tickets
      : detail.tickets.filter(ticket =>
          ticket.code.toLowerCase().includes(q)
          || ticket.guestName.toLowerCase().includes(q)
          || (ticket.guestEmail || "").toLowerCase().includes(q)
        );

    return [...base].sort((a, b) => {
      const aChecked = a.status === "checked_in";
      const bChecked = b.status === "checked_in";
      if (aChecked !== bChecked) return aChecked ? 1 : -1;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [detail, ticketQuery]);

  const ticketRows = filteredTickets.map((ticket) => {
    const statusLabel = ticket.status.replaceAll("_", " ");
    const canCheckIn = ticket.status === "confirmed";
    const canCancel = ticket.status === "confirmed" || ticket.status === "checked_in";
    const hasStripePayment = Boolean(ticket.stripePaymentIntentId);
    const actionControls = (
      <div className="flex w-full flex-wrap justify-end gap-2">
        {canCheckIn ? (
          <button
            onClick={() => checkInTicket(ticket)}
            disabled={actionLoadingTicketId === ticket.id}
            className="h-11 w-full rounded border border-green-300 px-3 text-xs text-green-700 transition-all duration-200 disabled:opacity-60 sm:w-auto"
          >
            {actionLoadingTicketId === ticket.id ? "Working..." : "Check In"}
          </button>
        ) : null}
        {canCancel ? (
          <button
            onClick={() => cancelOrRefundTicket(ticket)}
            disabled={actionLoadingTicketId === ticket.id}
            className="h-11 w-full rounded border border-red-300 px-3 text-xs text-red-700 transition-all duration-200 disabled:opacity-60 sm:w-auto"
          >
            {actionLoadingTicketId === ticket.id
              ? "Working..."
              : hasStripePayment
                ? "Refund"
                : "Cancel"}
          </button>
        ) : null}
        {!canCheckIn && !canCancel ? (
          <span className="text-xs text-gray-500">{statusLabel}</span>
        ) : null}
      </div>
    );

    return {
      key: ticket.id,
      mobileTitle: ticket.code,
      mobileSubtitle: `${ticket.guestName} • ${ticket.guestEmail}`,
      mobileMeta: [`Qty ${ticket.quantity}`, statusLabel],
      actions: actionControls,
      cells: [
        <div key="ticket">
          <div className="font-mono font-semibold">{ticket.code}</div>
          <div className="text-xs text-gray-500">Purchased {new Date(ticket.createdAt).toLocaleString()}</div>
        </div>,
        <div key="guest">
          <div className="font-medium">{ticket.guestName}</div>
          <div className="text-xs text-gray-500">{ticket.guestEmail}</div>
          {ticket.guestPhone ? <div className="text-xs text-gray-500">{ticket.guestPhone}</div> : null}
          <div className="text-xs text-gray-500">Qty: {ticket.quantity}</div>
        </div>,
        <div key="status">
          <span className={`text-xs px-2 py-1 rounded-full ${ticketBadge(ticket.status)}`}>{statusLabel}</span>
          {ticket.checkedInAt ? (
            <div className="text-xs text-gray-500 mt-1">✓ Checked in at {new Date(ticket.checkedInAt).toLocaleTimeString()}</div>
          ) : null}
        </div>,
        <div key="action" className="text-right">{actionControls}</div>,
      ],
    };
  });

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    const payload = {
      name: createForm.name,
      slug: createForm.slug || undefined,
      description: createForm.description || null,
      imageUrl: createForm.imageUrl || null,
      date: createForm.date,
      startTime: createForm.startTime,
      endTime: createForm.endTime || null,
      ticketPrice: Math.max(0, Math.round((parseFloat(createForm.ticketPriceDollars || "0") || 0) * 100)),
      maxTickets: Math.max(1, parseInt(createForm.maxTickets || "1", 10) || 1),
      isActive: true,
    };
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Unable to create event");
      return;
    }
    setCreateForm({
      name: "",
      slug: "",
      description: "",
      imageUrl: "",
      date: "",
      startTime: "18:00",
      endTime: "21:00",
      ticketPriceDollars: "79",
      maxTickets: "40",
    });
    setCreateOpen(false);
    await loadEvents();
    setSelectedId(data.id);
  }

  async function checkInTicket(ticket: EventTicket) {
    if (!detail) return;
    setActionLoadingTicketId(ticket.id);
    try {
      const res = await fetch(`/api/events/${detail.id}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: ticket.code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Check-in failed");
        return;
      }
      await loadSelected(detail.id);
      setSuccessFlash(`✅ ${data.guestName || "Guest"} checked in!`);
    } finally {
      setActionLoadingTicketId(null);
    }
  }

  async function cancelOrRefundTicket(ticket: EventTicket) {
    if (!detail) return;
    const hasStripePayment = Boolean(ticket.stripePaymentIntentId);
    const formattedAmount = formatCents(ticket.totalPaid);
    const confirmed = window.confirm(hasStripePayment
      ? `Cancel this ticket and refund ${formattedAmount} to ${ticket.guestName}?`
      : `Cancel this ticket for ${ticket.guestName}?`);
    if (!confirmed) return;

    setMessage("");
    setActionLoadingTicketId(ticket.id);
    try {
      const res = await fetch(`/api/events/${detail.id}/tickets/${ticket.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Could not cancel ticket.");
        return;
      }
      await Promise.all([loadEvents(), loadSelected(detail.id)]);
      setSuccessFlash(data.refunded ? "✅ Ticket refunded." : "✅ Ticket cancelled.");
    } finally {
      setActionLoadingTicketId(null);
    }
  }

  async function toggleActive() {
    if (!detail) return;
    const res = await fetch(`/api/events/${detail.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !detail.isActive }),
    });
    if (res.ok) {
      await Promise.all([loadEvents(), loadSelected(detail.id)]);
    }
  }

  async function saveEditedEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!detail) return;
    setMessage("");
    const payload = {
      name: editForm.name,
      slug: editForm.slug || undefined,
      description: editForm.description || null,
      imageUrl: editForm.imageUrl || null,
      date: editForm.date,
      startTime: editForm.startTime,
      endTime: editForm.endTime || null,
      ticketPrice: Math.max(0, Math.round((parseFloat(editForm.ticketPriceDollars || "0") || 0) * 100)),
      maxTickets: Math.max(1, parseInt(editForm.maxTickets || "1", 10) || 1),
      isActive: editForm.isActive,
    };
    const res = await fetch(`/api/events/${detail.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Unable to save event");
      return;
    }
    setEditOpen(false);
    setSuccessFlash("✅ Event updated.");
    await Promise.all([loadEvents(), loadSelected(detail.id)]);
  }

  async function deleteEvent() {
    if (!detail) return;
    const confirmed = window.confirm(`Delete "${detail.name}"? This will deactivate the event.`);
    if (!confirmed) return;
    setMessage("");
    const res = await fetch(`/api/events/${detail.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Unable to delete event");
      return;
    }
    setEditOpen(false);
    setSuccessFlash("✅ Event deactivated.");
    const list = await loadEvents();
    if (list.length > 0) {
      setSelectedId(list[0].id);
      await loadSelected(list[0].id);
    } else {
      setSelectedId(null);
      setDetail(null);
    }
  }

  function eventUrl(event: EventItem | EventDetail): string {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    return `${base}/events/${event.slug}`;
  }

  async function copyShareLink(event: EventItem | EventDetail) {
    const url = eventUrl(event);
    try {
      await navigator.clipboard.writeText(url);
      setCopyFlash("Link copied!");
    } catch {
      setCopyFlash(url);
    }
  }

  async function openQr(event: EventItem | EventDetail) {
    const url = eventUrl(event);
    const QRCode = await import("qrcode");
    const dataUrl = await QRCode.toDataURL(url, { width: 320, margin: 1 });
    setQrTitle(event.name);
    setQrDataUrl(dataUrl);
    setQrOpen(true);
  }

  async function addManualTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!detail) return;
    const quantity = Math.max(1, Math.min(10, parseInt(manualForm.quantity || "1", 10) || 1));

    const res = await fetch(`/api/events/${detail.id}/purchase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        manual: true,
        paid: manualForm.paid,
        guestName: manualForm.guestName,
        guestEmail: manualForm.guestEmail,
        guestPhone: manualForm.guestPhone,
        quantity,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Could not add ticket.");
      return;
    }

    setManualForm({ guestName: "", guestEmail: "", guestPhone: "", quantity: "1", paid: false });
    setManualOpen(false);
    await Promise.all([loadEvents(), loadSelected(detail.id)]);
    setSuccessFlash("✅ Ticket added manually.");
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-gray-500">
        <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
        Loading events...
      </div>
    );
  }

  if (licensed === false) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold mb-4">Events</h1>
        <div className="bg-white rounded-xl shadow p-6">
          <p className="text-gray-600">Feature not available for your current plan. Contact support to enable Event Ticketing.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Events</h1>
          <p className="text-sm text-gray-500">Create ticketed events, share event links, and check guests in at the door.</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="h-11 w-full rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-all duration-200 sm:w-auto"
        >
          New Event
        </button>
      </div>

      <div className="grid lg:grid-cols-[340px_1fr] gap-4">
        <div className="bg-white rounded-xl shadow p-3 sm:p-5 space-y-2 max-h-[680px] overflow-auto">
          {events.map(event => {
            const revenue = event.actualRevenue ?? 0;
            return (
              <div
                key={event.id}
                className={`rounded-lg border px-3 py-2 transition-all duration-200 ${selectedId === event.id ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"}`}
              >
                <button onClick={() => setSelectedId(event.id)} className="w-full text-left">
                  <div className="font-semibold">{event.name}</div>
                  <div className="text-xs text-gray-500">{formatDate(event.date)} · {formatTime12(event.startTime)}</div>
                  <div className="text-xs text-gray-500">{event.soldTickets}/{event.maxTickets} sold · {formatCents(revenue)}</div>
                </button>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <button onClick={() => copyShareLink(event)} className="h-11 w-full px-3 rounded border border-gray-200 text-xs sm:w-auto">Share Link</button>
                  <button onClick={() => openQr(event)} className="h-11 w-full px-3 rounded border border-gray-200 text-xs sm:w-auto">View QR Code</button>
                </div>
              </div>
            );
          })}
          {events.length === 0 && <div className="text-sm text-gray-500 p-3">No events yet.</div>}
        </div>

        <div className="bg-white rounded-xl shadow p-4 sm:p-6">
          {!detail ? (
            <div className="text-sm text-gray-500">Select an event to view details.</div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">{detail.name}</h2>
                  <p className="text-sm text-gray-500">{formatDate(detail.date)} · {formatTime12(detail.startTime)}{detail.endTime ? ` - ${formatTime12(detail.endTime)}` : ""}</p>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  <button onClick={() => copyShareLink(detail)} className="h-11 w-full px-3 rounded-lg border border-gray-200 text-sm transition-all duration-200 sm:w-auto">Share Link</button>
                  <button onClick={() => openQr(detail)} className="h-11 w-full px-3 rounded-lg border border-gray-200 text-sm transition-all duration-200 sm:w-auto">View QR Code</button>
                  <button onClick={() => setEditOpen(true)} className="h-11 w-full px-3 rounded-lg border border-gray-200 text-sm transition-all duration-200 sm:w-auto">
                    Edit
                  </button>
                  <button onClick={toggleActive} className="h-11 w-full px-3 rounded-lg border border-gray-200 text-sm transition-all duration-200 sm:w-auto">
                    {detail.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <button onClick={deleteEvent} className="h-11 w-full px-3 rounded-lg border border-red-200 text-red-700 text-sm transition-all duration-200 sm:w-auto">
                    Delete
                  </button>
                </div>
              </div>

              <div className="grid sm:grid-cols-4 gap-3">
                <div className="rounded-lg bg-gray-50 p-3 border"><div className="text-xs text-gray-500">Tickets Sold</div><div className="text-lg font-bold">{detail.soldTickets}</div></div>
                <div className="rounded-lg bg-gray-50 p-3 border"><div className="text-xs text-gray-500">Remaining</div><div className="text-lg font-bold">{detail.remainingTickets}</div></div>
                <div className="rounded-lg bg-gray-50 p-3 border"><div className="text-xs text-gray-500">Revenue</div><div className="text-lg font-bold">{formatCents(detail.actualRevenue ?? detail.revenue ?? 0)}</div></div>
                <div className="rounded-lg bg-gray-50 p-3 border"><div className="text-xs text-gray-500">Check-in Rate</div><div className="text-lg font-bold">{detail.checkInRate}%</div></div>
              </div>

              {successFlash && (
                <div className="rounded-lg border border-green-300 bg-green-50 text-green-700 text-sm px-3 py-2">{successFlash}</div>
              )}

              <div className="rounded-lg border border-gray-200 p-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">Check-in</h3>
                  <button
                    onClick={() => setManualOpen(v => !v)}
                    className="h-11 w-full px-3 rounded border border-gray-200 text-sm sm:w-auto"
                  >
                    {manualOpen ? "Close Manual Add" : "Add Ticket Manually"}
                  </button>
                </div>

                <input
                  value={ticketQuery}
                  onChange={e => setTicketQuery(e.target.value)}
                  placeholder="Enter ticket code or guest name"
                  className="h-11 w-full border rounded px-3"
                />

                {manualOpen && (
                  <form onSubmit={addManualTicket} className="grid gap-2 border rounded-lg p-3 bg-gray-50 sm:grid-cols-2">
                    <input required value={manualForm.guestName} onChange={e => setManualForm(prev => ({ ...prev, guestName: e.target.value }))} placeholder="Guest name" className="h-11 border rounded px-3" />
                    <input required type="email" value={manualForm.guestEmail} onChange={e => setManualForm(prev => ({ ...prev, guestEmail: e.target.value }))} placeholder="Guest email" className="h-11 border rounded px-3" />
                    <input value={manualForm.guestPhone} onChange={e => setManualForm(prev => ({ ...prev, guestPhone: e.target.value }))} placeholder="Guest phone" className="h-11 border rounded px-3" />
                    <input value={manualForm.quantity} onChange={e => setManualForm(prev => ({ ...prev, quantity: e.target.value }))} placeholder="Quantity" type="number" min="1" max="10" className="h-11 border rounded px-3" />
                    <label className="sm:col-span-2 text-sm flex items-center gap-2">
                      <input type="checkbox" checked={manualForm.paid} onChange={e => setManualForm(prev => ({ ...prev, paid: e.target.checked }))} className="h-4 w-4" />
                      Mark as paid
                    </label>
                    <button type="submit" className="sm:col-span-2 h-11 w-full rounded bg-blue-600 text-white text-sm font-medium sm:w-auto">Save Ticket</button>
                  </form>
                )}
              </div>

              <ResponsiveTable
                headers={["Ticket", "Guest", "Status", "Action"]}
                rows={ticketRows}
                emptyMessage="No tickets found."
              />
            </div>
          )}
        </div>
      </div>

      {message && <p className="text-sm text-red-600">{message}</p>}
      {copyFlash && <p className="text-sm text-green-700">{copyFlash}</p>}

      {createOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 p-0 sm:flex sm:items-center sm:justify-center sm:px-4"
          onClick={() => setCreateOpen(false)}
        >
          <div
            className="h-full w-full overflow-y-auto bg-white p-4 sm:h-auto sm:max-w-2xl sm:rounded-xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Create Event</h3>
              <button onClick={() => setCreateOpen(false)} className="h-11 w-11 rounded border border-gray-200">✕</button>
            </div>
            <form onSubmit={createEvent} className="grid gap-3 sm:grid-cols-2">
              <input value={createForm.name} onChange={e => setCreateForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Event name" className="h-11 border rounded px-3" required />
              <input value={createForm.slug} onChange={e => setCreateForm(prev => ({ ...prev, slug: e.target.value }))} placeholder="Custom slug (optional)" className="h-11 border rounded px-3" />
              <input value={createForm.imageUrl} onChange={e => setCreateForm(prev => ({ ...prev, imageUrl: e.target.value }))} placeholder="Image URL (optional)" className="h-11 border rounded px-3 sm:col-span-2" />
              <input type="date" value={createForm.date} onChange={e => setCreateForm(prev => ({ ...prev, date: e.target.value }))} className="h-11 border rounded px-3" required />
              <input type="time" value={createForm.startTime} onChange={e => setCreateForm(prev => ({ ...prev, startTime: e.target.value }))} className="h-11 border rounded px-3" required />
              <input type="time" value={createForm.endTime} onChange={e => setCreateForm(prev => ({ ...prev, endTime: e.target.value }))} className="h-11 border rounded px-3" />
              <input type="number" step="0.01" min="0" value={createForm.ticketPriceDollars} onChange={e => setCreateForm(prev => ({ ...prev, ticketPriceDollars: e.target.value }))} placeholder="Ticket price (USD)" className="h-11 border rounded px-3" required />
              <input type="number" min="1" value={createForm.maxTickets} onChange={e => setCreateForm(prev => ({ ...prev, maxTickets: e.target.value }))} placeholder="Max tickets" className="h-11 border rounded px-3 sm:col-span-2" required />
              <textarea value={createForm.description} onChange={e => setCreateForm(prev => ({ ...prev, description: e.target.value }))} placeholder="Description" className="sm:col-span-2 border rounded px-3 py-2" rows={3} />
              <div className="sm:col-span-2 flex flex-col gap-2 sm:flex-row">
                <button type="submit" className="h-11 w-full rounded bg-blue-600 text-sm font-medium text-white sm:w-auto">Create Event</button>
                <button type="button" onClick={() => setCreateOpen(false)} className="h-11 w-full rounded border border-gray-200 text-sm sm:w-auto">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editOpen && detail && (
        <div
          className="fixed inset-0 z-50 bg-black/40 p-0 sm:flex sm:items-center sm:justify-center sm:px-4"
          onClick={() => setEditOpen(false)}
        >
          <div
            className="h-full w-full overflow-y-auto bg-white p-4 sm:h-auto sm:max-w-2xl sm:rounded-xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Edit Event</h3>
              <button onClick={() => setEditOpen(false)} className="h-11 w-11 rounded border border-gray-200">✕</button>
            </div>
            <form onSubmit={saveEditedEvent} className="grid gap-3 sm:grid-cols-2">
              <input value={editForm.name} onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Event name" className="h-11 border rounded px-3" required />
              <input value={editForm.slug} onChange={(e) => setEditForm((prev) => ({ ...prev, slug: e.target.value }))} placeholder="Slug" className="h-11 border rounded px-3" />
              <input type="date" value={editForm.date} onChange={(e) => setEditForm((prev) => ({ ...prev, date: e.target.value }))} className="h-11 border rounded px-3" required />
              <input type="time" value={editForm.startTime} onChange={(e) => setEditForm((prev) => ({ ...prev, startTime: e.target.value }))} className="h-11 border rounded px-3" required />
              <input type="time" value={editForm.endTime} onChange={(e) => setEditForm((prev) => ({ ...prev, endTime: e.target.value }))} className="h-11 border rounded px-3" />
              <input type="number" step="0.01" min="0" value={editForm.ticketPriceDollars} onChange={(e) => setEditForm((prev) => ({ ...prev, ticketPriceDollars: e.target.value }))} placeholder="Ticket price (USD)" className="h-11 border rounded px-3" required />
              <input type="number" min="1" value={editForm.maxTickets} onChange={(e) => setEditForm((prev) => ({ ...prev, maxTickets: e.target.value }))} placeholder="Max tickets" className="h-11 border rounded px-3" required />
              <input value={editForm.imageUrl} onChange={(e) => setEditForm((prev) => ({ ...prev, imageUrl: e.target.value }))} placeholder="Image URL" className="h-11 border rounded px-3" />
              <textarea value={editForm.description} onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Description" className="sm:col-span-2 border rounded px-3 py-2" rows={3} />
              <label className="sm:col-span-2 inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm((prev) => ({ ...prev, isActive: e.target.checked }))} className="h-4 w-4" />
                Event is active
              </label>
              <div className="sm:col-span-2 flex flex-col gap-2 sm:flex-row">
                <button type="submit" className="h-11 w-full rounded bg-blue-600 text-sm font-medium text-white sm:w-auto">Save Changes</button>
                <button type="button" onClick={() => setEditOpen(false)} className="h-11 w-full rounded border border-gray-200 text-sm sm:w-auto">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {qrOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 p-0 sm:flex sm:items-center sm:justify-center sm:px-4" onClick={() => setQrOpen(false)}>
          <div className="h-full w-full overflow-y-auto bg-white p-4 sm:h-auto sm:max-w-sm sm:rounded-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">QR Code · {qrTitle}</h3>
              <button onClick={() => setQrOpen(false)} className="h-11 w-11 rounded border border-gray-200">✕</button>
            </div>
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Event QR code" className="mx-auto h-72 w-72 max-w-full" />
            ) : (
              <p className="text-sm text-gray-500">Loading QR code...</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
