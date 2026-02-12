"use client";
import { useEffect, useMemo, useState } from "react";

type TicketStatus = "confirmed" | "checked_in" | "cancelled" | "refunded";

interface EventTicket {
  id: number;
  guestName: string;
  guestEmail: string;
  guestPhone: string | null;
  quantity: number;
  totalPaid: number;
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
}

interface EventDetail extends EventItem {
  tickets: EventTicket[];
  remainingTickets: number;
  revenue: number;
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
  const [licensed, setLicensed] = useState<boolean | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [successFlash, setSuccessFlash] = useState("");
  const [ticketQuery, setTicketQuery] = useState("");
  const [copyFlash, setCopyFlash] = useState("");

  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrTitle, setQrTitle] = useState("");

  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    date: "",
    startTime: "18:00",
    endTime: "21:00",
    ticketPriceDollars: "79",
    maxTickets: "40",
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
  }

  async function loadSelected(id: number) {
    const res = await fetch(`/api/events/${id}`);
    const data = await res.json();
    if (res.ok) setDetail(data as EventDetail);
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then(r => r.json()),
      fetch("/api/auth/me").then(r => (r.ok ? r.json() : null)).catch(() => null),
      loadEvents(),
    ])
      .then(([settings, session]) => {
        const key = String(settings.license_events || "").toUpperCase();
        const hasKey = /^RS-EVT-[A-Z0-9]{8}$/.test(key);
        const isAdmin = session?.role === "admin" || session?.role === "superadmin";
        setLicensed(hasKey || isAdmin);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    loadSelected(selectedId);
  }, [selectedId]);

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

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    const payload = {
      name: createForm.name,
      description: createForm.description || null,
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
      description: "",
      date: "",
      startTime: "18:00",
      endTime: "21:00",
      ticketPriceDollars: "79",
      maxTickets: "40",
    });
    await loadEvents();
    setSelectedId(data.id);
  }

  async function checkInTicket(code: string) {
    if (!detail) return;
    const res = await fetch(`/api/events/${detail.id}/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Check-in failed");
      return;
    }
    await loadSelected(detail.id);
    setSuccessFlash(`✅ ${data.guestName || "Guest"} checked in!`);
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

  function eventUrl(event: EventItem | EventDetail): string {
    const base = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
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
          <p className="text-gray-600 mb-4">Event Ticketing is a paid add-on.</p>
          <a href="/#pricing" className="inline-flex items-center h-11 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium transition-all duration-200">Upgrade to Unlock</a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Events</h1>
        <p className="text-sm text-gray-500">Create ticketed events, share event links, and check guests in at the door.</p>
      </div>

      <form onSubmit={createEvent} className="bg-white rounded-xl shadow p-4 sm:p-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <input value={createForm.name} onChange={e => setCreateForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Event name" className="h-11 border rounded px-3" required />
        <input type="date" value={createForm.date} onChange={e => setCreateForm(prev => ({ ...prev, date: e.target.value }))} className="h-11 border rounded px-3" required />
        <input type="time" value={createForm.startTime} onChange={e => setCreateForm(prev => ({ ...prev, startTime: e.target.value }))} className="h-11 border rounded px-3" required />
        <input type="time" value={createForm.endTime} onChange={e => setCreateForm(prev => ({ ...prev, endTime: e.target.value }))} className="h-11 border rounded px-3" />
        <input type="number" step="0.01" min="0" value={createForm.ticketPriceDollars} onChange={e => setCreateForm(prev => ({ ...prev, ticketPriceDollars: e.target.value }))} placeholder="Ticket price (USD)" className="h-11 border rounded px-3" required />
        <input type="number" min="1" value={createForm.maxTickets} onChange={e => setCreateForm(prev => ({ ...prev, maxTickets: e.target.value }))} placeholder="Max tickets" className="h-11 border rounded px-3" required />
        <textarea value={createForm.description} onChange={e => setCreateForm(prev => ({ ...prev, description: e.target.value }))} placeholder="Description" className="sm:col-span-2 lg:col-span-3 border rounded px-3 py-2" rows={2} />
        <button type="submit" className="sm:col-span-2 lg:col-span-3 h-11 rounded bg-blue-600 text-white text-sm font-medium transition-all duration-200">Create Event</button>
      </form>

      <div className="grid lg:grid-cols-[340px_1fr] gap-4">
        <div className="bg-white rounded-xl shadow p-3 space-y-2 max-h-[680px] overflow-auto">
          {events.map(event => {
            const revenue = event.soldTickets * event.ticketPrice;
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
                <div className="mt-2 flex gap-2">
                  <button onClick={() => copyShareLink(event)} className="h-8 px-2 rounded border border-gray-200 text-xs">Share Link</button>
                  <button onClick={() => openQr(event)} className="h-8 px-2 rounded border border-gray-200 text-xs">View QR Code</button>
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
                <div className="flex gap-2">
                  <button onClick={() => copyShareLink(detail)} className="h-11 px-3 rounded-lg border border-gray-200 text-sm transition-all duration-200">Share Link</button>
                  <button onClick={() => openQr(detail)} className="h-11 px-3 rounded-lg border border-gray-200 text-sm transition-all duration-200">View QR Code</button>
                  <button onClick={toggleActive} className="h-11 px-3 rounded-lg border border-gray-200 text-sm transition-all duration-200">
                    {detail.isActive ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>

              <div className="grid sm:grid-cols-4 gap-3">
                <div className="rounded-lg bg-gray-50 p-3 border"><div className="text-xs text-gray-500">Tickets Sold</div><div className="text-lg font-bold">{detail.soldTickets}</div></div>
                <div className="rounded-lg bg-gray-50 p-3 border"><div className="text-xs text-gray-500">Remaining</div><div className="text-lg font-bold">{detail.remainingTickets}</div></div>
                <div className="rounded-lg bg-gray-50 p-3 border"><div className="text-xs text-gray-500">Revenue</div><div className="text-lg font-bold">{formatCents(detail.soldTickets * detail.ticketPrice)}</div></div>
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
                    className="h-9 px-3 rounded border border-gray-200 text-sm"
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
                  <form onSubmit={addManualTicket} className="grid sm:grid-cols-2 gap-2 border rounded-lg p-3 bg-gray-50">
                    <input required value={manualForm.guestName} onChange={e => setManualForm(prev => ({ ...prev, guestName: e.target.value }))} placeholder="Guest name" className="h-10 border rounded px-3" />
                    <input required type="email" value={manualForm.guestEmail} onChange={e => setManualForm(prev => ({ ...prev, guestEmail: e.target.value }))} placeholder="Guest email" className="h-10 border rounded px-3" />
                    <input value={manualForm.guestPhone} onChange={e => setManualForm(prev => ({ ...prev, guestPhone: e.target.value }))} placeholder="Guest phone" className="h-10 border rounded px-3" />
                    <input value={manualForm.quantity} onChange={e => setManualForm(prev => ({ ...prev, quantity: e.target.value }))} placeholder="Quantity" type="number" min="1" max="10" className="h-10 border rounded px-3" />
                    <label className="sm:col-span-2 text-sm flex items-center gap-2">
                      <input type="checkbox" checked={manualForm.paid} onChange={e => setManualForm(prev => ({ ...prev, paid: e.target.checked }))} className="h-4 w-4" />
                      Mark as paid
                    </label>
                    <button type="submit" className="sm:col-span-2 h-10 rounded bg-blue-600 text-white text-sm font-medium">Save Ticket</button>
                  </form>
                )}
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-[1.3fr_1fr_0.8fr_0.8fr] bg-gray-50 border-b text-xs font-semibold text-gray-600 px-3 py-2">
                  <div>Ticket</div>
                  <div>Guest</div>
                  <div>Status</div>
                  <div className="text-right">Action</div>
                </div>
                <div className="max-h-[420px] overflow-auto divide-y">
                  {filteredTickets.map(ticket => (
                    <div key={ticket.id} className="px-3 py-2 grid grid-cols-[1.3fr_1fr_0.8fr_0.8fr] gap-2 items-center text-sm">
                      <div>
                        <div className="font-mono font-semibold">{ticket.code}</div>
                        <div className="text-xs text-gray-500">Purchased {new Date(ticket.createdAt).toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="font-medium">{ticket.guestName}</div>
                        <div className="text-xs text-gray-500">{ticket.guestEmail}</div>
                        {ticket.guestPhone && <div className="text-xs text-gray-500">{ticket.guestPhone}</div>}
                        <div className="text-xs text-gray-500">Qty: {ticket.quantity}</div>
                      </div>
                      <div>
                        <span className={`text-xs px-2 py-1 rounded-full ${ticketBadge(ticket.status)}`}>{ticket.status.replaceAll("_", " ")}</span>
                        {ticket.checkedInAt && (
                          <div className="text-xs text-gray-500 mt-1">✓ Checked in at {new Date(ticket.checkedInAt).toLocaleTimeString()}</div>
                        )}
                      </div>
                      <div className="text-right">
                        {ticket.status !== "checked_in" ? (
                          <button
                            onClick={() => checkInTicket(ticket.code)}
                            className="h-9 px-3 rounded border border-green-300 text-green-700 text-xs transition-all duration-200"
                          >
                            Check In
                          </button>
                        ) : (
                          <span className="text-xs text-gray-500">Checked In</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {filteredTickets.length === 0 && (
                    <div className="p-3 text-sm text-gray-500">No tickets found.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {message && <p className="text-sm text-red-600">{message}</p>}
      {copyFlash && <p className="text-sm text-green-700">{copyFlash}</p>}

      {qrOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setQrOpen(false)}>
          <div className="bg-white rounded-xl p-4 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">QR Code · {qrTitle}</h3>
              <button onClick={() => setQrOpen(false)} className="h-8 w-8 rounded border border-gray-200">✕</button>
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
