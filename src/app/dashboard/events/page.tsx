"use client";
import { useEffect, useMemo, useState } from "react";

interface EventTicket {
  id: number;
  guestName: string;
  guestEmail: string;
  quantity: number;
  totalPaid: number;
  status: string;
  code: string;
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

export default function EventsDashboardPage() {
  const [licensed, setLicensed] = useState<boolean | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [ticketQuery, setTicketQuery] = useState("");
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    date: "",
    startTime: "18:00",
    endTime: "21:00",
    ticketPriceDollars: "79",
    maxTickets: "40",
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
    if (res.ok) setDetail(data);
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

  const filteredTickets = useMemo(() => {
    if (!detail) return [];
    if (!ticketQuery.trim()) return detail.tickets;
    const q = ticketQuery.trim().toUpperCase();
    return detail.tickets.filter(ticket => ticket.code.toUpperCase().includes(q) || ticket.guestName.toUpperCase().includes(q));
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
        <p className="text-sm text-gray-500">Create ticketed events and check in guests at the door.</p>
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

      <div className="grid lg:grid-cols-[320px_1fr] gap-4">
        <div className="bg-white rounded-xl shadow p-3 space-y-2 max-h-[640px] overflow-auto">
          {events.map(event => (
            <button
              key={event.id}
              onClick={() => setSelectedId(event.id)}
              className={`w-full text-left rounded-lg border px-3 py-2 transition-all duration-200 ${selectedId === event.id ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"}`}
            >
              <div className="font-semibold">{event.name}</div>
              <div className="text-xs text-gray-500">{event.date}</div>
              <div className="text-xs text-gray-500">{event.soldTickets}/{event.maxTickets} tickets · {formatCents(event.ticketPrice)}</div>
            </button>
          ))}
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
                  <p className="text-sm text-gray-500">{detail.date} · {detail.startTime}{detail.endTime ? ` - ${detail.endTime}` : ""}</p>
                </div>
                <button onClick={toggleActive} className="h-11 px-3 rounded-lg border border-gray-200 text-sm transition-all duration-200">
                  {detail.isActive ? "Deactivate" : "Activate"}
                </button>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <div className="rounded-lg bg-gray-50 p-3 border"><div className="text-xs text-gray-500">Tickets Sold</div><div className="text-lg font-bold">{detail.soldTickets}/{detail.maxTickets}</div></div>
                <div className="rounded-lg bg-gray-50 p-3 border"><div className="text-xs text-gray-500">Revenue</div><div className="text-lg font-bold">{formatCents(detail.revenue)}</div></div>
                <div className="rounded-lg bg-gray-50 p-3 border"><div className="text-xs text-gray-500">Check-in Rate</div><div className="text-lg font-bold">{detail.checkInRate}%</div></div>
              </div>

              <div className="flex flex-wrap gap-2">
                <input value={ticketQuery} onChange={e => setTicketQuery(e.target.value)} placeholder="Search code or guest" className="h-11 flex-1 min-w-[220px] border rounded px-3" />
                <button
                  onClick={() => {
                    const code = ticketQuery.trim().toUpperCase();
                    if (!code) return;
                    checkInTicket(code);
                  }}
                  className="h-11 px-4 rounded bg-green-600 text-white text-sm font-medium transition-all duration-200"
                >
                  Check In by Code
                </button>
              </div>

              <div className="divide-y border rounded-lg max-h-[380px] overflow-auto">
                {filteredTickets.map(ticket => (
                  <div key={ticket.id} className="px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div>
                      <div className="font-medium">{ticket.guestName}</div>
                      <div className="text-gray-500">{ticket.guestEmail}</div>
                      <div className="text-xs text-gray-500">{ticket.code} · {ticket.quantity} ticket{ticket.quantity === 1 ? "" : "s"}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-100 capitalize">{ticket.status.replace("_", " ")}</span>
                      {ticket.status !== "checked_in" && (
                        <button onClick={() => checkInTicket(ticket.code)} className="h-9 px-3 rounded border border-green-300 text-green-700 text-xs transition-all duration-200">Check In</button>
                      )}
                    </div>
                  </div>
                ))}
                {filteredTickets.length === 0 && <div className="p-3 text-sm text-gray-500">No tickets found.</div>}
              </div>
            </div>
          )}
        </div>
      </div>

      {message && <p className="text-sm text-red-600">{message}</p>}
    </div>
  );
}
