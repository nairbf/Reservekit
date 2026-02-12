import Link from "next/link";
import { prisma } from "@/lib/db";

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

export default async function EventsPage() {
  const today = new Date().toISOString().split("T")[0];

  const [events, restaurantRow] = await Promise.all([
    prisma.event.findMany({
      where: { isActive: true, date: { gte: today } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    prisma.setting.findUnique({ where: { key: "restaurantName" } }),
  ]);

  const restaurantName = restaurantRow?.value || "ReserveSit";

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-slate-100 px-4 py-10">
      <div className="max-w-6xl mx-auto">
        <p className="text-sm uppercase tracking-wide text-blue-700 font-semibold">{restaurantName}</p>
        <h1 className="text-3xl sm:text-4xl font-bold mt-1">Upcoming Events</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-2 mb-6">Book special dinners, tastings, and limited-seat experiences.</p>

        {events.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-10 text-center border border-gray-100">
            <p className="text-gray-500 text-lg">No upcoming events. Check back soon!</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map(event => {
              const remainingTickets = Math.max(0, event.maxTickets - event.soldTickets);
              const soldOut = remainingTickets <= 0;
              return (
                <Link
                  key={event.id}
                  href={`/events/${event.slug}`}
                  className={`rounded-2xl border p-5 transition-all duration-200 ${soldOut ? "bg-gray-100 border-gray-200 opacity-80" : "bg-white border-gray-100 hover:shadow-lg hover:-translate-y-0.5"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-gray-500">{formatDate(event.date)} · {formatTime12(event.startTime)}</p>
                      <h2 className="text-xl font-bold mt-1 text-gray-900">{event.name}</h2>
                    </div>
                    {soldOut ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">Sold Out</span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">{remainingTickets} left</span>
                    )}
                  </div>

                  {event.description && (
                    <p className="text-sm text-gray-600 mt-3 line-clamp-3">{event.description}</p>
                  )}

                  <div className="mt-5 flex items-center justify-between">
                    <span className="text-lg font-semibold text-gray-900">${(event.ticketPrice / 100).toFixed(2)}</span>
                    <span className="text-sm font-medium text-blue-700">View Event</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
