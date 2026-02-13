import Image from "next/image";
import Link from "next/link";

interface EventCard {
  id: number;
  name: string;
  description: string | null;
  date: string;
  startTime: string;
  ticketPrice: number;
  slug: string;
  imageUrl: string | null;
}

interface EventsSectionProps {
  events: EventCard[];
  accentColor: string;
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(value: string): string {
  const [hourStr, minuteStr] = value.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

export function EventsSection({ events, accentColor }: EventsSectionProps) {
  if (events.length === 0) return null;

  return (
    <section className="bg-stone-50/80">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:px-8 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Plan Ahead</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 font-serif">Upcoming Events</h2>
          </div>
          <Link href="/events" className="text-sm font-medium transition-colors duration-200" style={{ color: accentColor }}>
            View All Events
          </Link>
        </div>

        <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {events.map(event => (
            <Link
              key={event.id}
              href={`/events/${event.slug}`}
              className="group overflow-hidden rounded-xl border border-gray-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="relative h-40 w-full bg-gradient-to-br from-slate-100 to-slate-200">
                {event.imageUrl ? (
                  <Image
                    src={event.imageUrl}
                    alt={event.name}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 25vw"
                  />
                ) : null}
              </div>
              <div className="p-4">
                <p className="text-xs font-medium text-gray-500">{formatDate(event.date)} · {formatTime(event.startTime)}</p>
                <h3 className="mt-1 text-base font-semibold text-gray-900">{event.name}</h3>
                {event.description ? (
                  <p className="mt-2 text-sm text-gray-600">{event.description}</p>
                ) : null}
                <p className="mt-3 text-sm font-semibold" style={{ color: accentColor }}>
                  ${(event.ticketPrice / 100).toFixed(2)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
