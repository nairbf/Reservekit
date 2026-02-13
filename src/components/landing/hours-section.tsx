interface HoursRow {
  day: string;
  isClosed: boolean;
  openTime: string;
  closeTime: string;
}

interface HoursSectionProps {
  address: string;
  hours: HoursRow[];
  accentColor: string;
}

function formatTime(value: string): string {
  const [hourStr, minuteStr] = String(value).split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

export function HoursSection({ address, hours, accentColor }: HoursSectionProps) {
  const mapsLink = address.trim()
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : "";

  return (
    <section className="mx-auto max-w-6xl px-6 py-16 sm:px-8 lg:px-10">
      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Plan Your Visit</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 font-serif">Hours & Location</h2>

          {address ? (
            <div className="mt-5 rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-sm font-medium text-gray-900">Address</p>
              <p className="mt-1 text-sm text-gray-600">{address}</p>
              {mapsLink ? (
                <a
                  href={mapsLink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex min-h-11 items-center text-sm font-medium"
                  style={{ color: accentColor }}
                >
                  Open in Maps
                </a>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Operating Hours</h3>
          <div className="mt-3 divide-y divide-gray-100">
            {hours.map(row => (
              <div key={row.day} className="flex items-center justify-between py-2.5 text-sm">
                <span className="font-medium text-gray-900">{row.day}</span>
                <span className="text-gray-600">
                  {row.isClosed ? "Closed" : `${formatTime(row.openTime)} - ${formatTime(row.closeTime)}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
