"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

interface EventItem {
  id: number;
  name: string;
  description: string | null;
  date: string;
  startTime: string;
  ticketPrice: number;
  maxTickets: number;
  soldTickets: number;
  slug: string;
  remainingTickets: number;
  soldOut: boolean;
}

function formatTime12(value: string): string {
  const [h, m] = String(value || "00:00").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return value;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/events")
      .then(r => r.json())
      .then(data => setEvents(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-10">
        <div className="max-w-5xl mx-auto flex items-center gap-3 text-gray-500">
          <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
          Loading events...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Upcoming Events</h1>
        <p className="text-sm text-gray-500 mb-6">Book special dinners and pre-paid experiences.</p>

        {events.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-10 text-center text-gray-500">No upcoming events. Check back soon!</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map(event => (
              <Link key={event.id} href={`/events/${event.slug}`} className="bg-white rounded-xl shadow p-5 border border-gray-100 hover:shadow-md transition-all duration-200">
                <div className="text-sm text-gray-500">{event.date} · {formatTime12(event.startTime)}</div>
                <h2 className="text-lg font-bold mt-1">{event.name}</h2>
                {event.description && <p className="text-sm text-gray-600 mt-2 line-clamp-3">{event.description}</p>}
                <div className="mt-4 flex items-center justify-between">
                  <span className="font-semibold">${(event.ticketPrice / 100).toFixed(2)}</span>
                  {event.soldOut ? (
                    <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">Sold Out</span>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700">{event.remainingTickets} left</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
