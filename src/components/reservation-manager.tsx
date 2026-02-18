"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

interface ReservationLookup {
  guestName: string;
  date: string;
  time: string;
  partySize: number;
  status: string;
  code: string;
}

interface Slot {
  time: string;
  available: boolean;
}

interface ReservationManagerProps {
  restaurantName: string;
  accentColor: string;
  logoUrl: string;
  slug: string;
  phone: string;
  email: string;
}

function formatTime12(value: string): string {
  const [h, m] = String(value || "00:00").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return value;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function formatDateNice(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function statusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

function statusBadgeClass(status: string): string {
  if (["approved", "confirmed", "seated", "arrived"].includes(status)) {
    return "bg-green-100 text-green-800 border-green-200";
  }
  if (["pending", "counter_offered"].includes(status)) {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }
  if (["cancelled", "declined", "no_show", "completed", "expired"].includes(status)) {
    return "bg-red-100 text-red-700 border-red-200";
  }
  return "bg-gray-100 text-gray-700 border-gray-200";
}

function safeAccentColor(value: string): string {
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value || "")) return value;
  return "#1e3a5f";
}

export function ReservationManager({
  restaurantName,
  accentColor,
  logoUrl,
  slug,
  phone,
  email,
}: ReservationManagerProps) {
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [lookup, setLookup] = useState<ReservationLookup | null>(null);
  const [error, setError] = useState("");
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [mode, setMode] = useState<"view" | "modify" | "confirm_cancel" | "cancelled" | "modified">("view");
  const [newDate, setNewDate] = useState("");
  const [newPartySize, setNewPartySize] = useState(2);
  const [newTime, setNewTime] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [busy, setBusy] = useState(false);

  const safeAccent = safeAccentColor(accentColor);

  useEffect(() => {
    const codeParam = searchParams.get("code");
    if (!codeParam) return;
    setCode((current) => current || codeParam.trim().toUpperCase());
  }, [searchParams]);

  useEffect(() => {
    if (!lookup) return;
    setNewDate(lookup.date);
    setNewPartySize(lookup.partySize);
    setNewTime(lookup.time);
  }, [lookup]);

  useEffect(() => {
    if (mode !== "modify" || !newDate) return;
    setLoadingSlots(true);
    fetch(`/api/availability?date=${encodeURIComponent(newDate)}&partySize=${newPartySize}`)
      .then((response) => response.json())
      .then((data) => setSlots(Array.isArray(data.slots) ? data.slots : []))
      .finally(() => setLoadingSlots(false));
  }, [mode, newDate, newPartySize]);

  const isTerminal = useMemo(() => {
    if (!lookup) return false;
    return ["cancelled", "completed", "no_show", "declined", "expired"].includes(lookup.status);
  }, [lookup]);

  const reserveLink = slug ? `/reserve/${slug}` : "/";

  async function runLookup(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoadingLookup(true);
    try {
      const response = await fetch(`/api/reservations/lookup?code=${encodeURIComponent(code)}&phone=${encodeURIComponent(phoneInput)}`);
      const data = await response.json();
      if (!response.ok) {
        setLookup(null);
        setError(data.error || "We couldn't find that reservation. Check your code and phone number.");
        return;
      }
      setLookup(data);
      setMode("view");
    } finally {
      setLoadingLookup(false);
    }
  }

  async function submitCancel() {
    if (!lookup) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/reservations/self-service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: lookup.code, phone: phoneInput, action: "cancel" }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Unable to cancel reservation.");
        return;
      }
      setLookup((current) => (current ? { ...current, status: "cancelled" } : current));
      setMode("cancelled");
    } finally {
      setBusy(false);
    }
  }

  async function submitModify() {
    if (!lookup) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/reservations/self-service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: lookup.code,
          phone: phoneInput,
          action: "modify",
          newDate,
          newTime,
          newPartySize,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Unable to modify reservation.");
        return;
      }
      setLookup((current) => (current ? { ...current, date: newDate, time: newTime, partySize: newPartySize } : current));
      setMode("modified");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 px-4 py-10" style={{ "--accent": safeAccent } as CSSProperties}>
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 text-center">
          <Link href="/" className="inline-flex text-sm text-gray-600 hover:text-gray-900">
            ← Back to {restaurantName}
          </Link>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="h-1.5" style={{ backgroundColor: safeAccent }} />
          <div className="space-y-5 p-5 sm:p-7">
            <header className="text-center">
              {logoUrl ? (
                <img src={logoUrl} alt={restaurantName} className="mx-auto mb-3 h-12 w-auto object-contain" />
              ) : null}
              <h1 className="text-2xl font-bold text-gray-900">{restaurantName}</h1>
              <p className="mt-1 text-sm text-gray-500">Manage Your Reservation</p>
            </header>

            {!lookup ? (
              <form onSubmit={runLookup} className="space-y-3">
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  placeholder="Reservation code (e.g. RS-A1B2)"
                  className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  required
                />
                <input
                  value={phoneInput}
                  onChange={(event) => setPhoneInput(event.target.value)}
                  placeholder="Phone number"
                  className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  required
                />
                <button
                  type="submit"
                  disabled={loadingLookup}
                  className="h-11 w-full rounded-lg text-sm font-medium text-white transition-all duration-200 disabled:opacity-60"
                  style={{ backgroundColor: safeAccent }}
                >
                  {loadingLookup ? "Looking up..." : "Find Reservation"}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-gray-200 bg-stone-50 p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-lg font-semibold text-gray-900">{lookup.guestName || "Guest"}</div>
                    <span className={`rounded-full border px-2 py-1 text-xs font-medium capitalize ${statusBadgeClass(lookup.status)}`}>
                      {statusLabel(lookup.status)}
                    </span>
                  </div>
                  <div className="grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
                    <div>
                      Date: {formatDateNice(lookup.date)}
                    </div>
                    <div>
                      Time: {formatTime12(lookup.time)}
                    </div>
                    <div>
                      Party of {lookup.partySize}
                    </div>
                    <div className="text-gray-500">Ref: {lookup.code}</div>
                  </div>
                </div>

                {isTerminal ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                    This reservation is already {statusLabel(lookup.status)}.
                  </div>
                ) : mode === "modify" ? (
                  <div className="space-y-3">
                    <input
                      type="date"
                      value={newDate}
                      onChange={(event) => setNewDate(event.target.value)}
                      className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                    <input
                      type="number"
                      min={1}
                      value={newPartySize}
                      onChange={(event) => setNewPartySize(Math.max(1, Number(event.target.value) || 1))}
                      className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />

                    {loadingSlots ? (
                      <p className="text-sm text-gray-500">Loading available times...</p>
                    ) : (
                      <>
                        {slots.length === 0 ? (
                          <p className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                            No time slots are available for this date.
                          </p>
                        ) : null}
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                          {slots.map((slot) => (
                            <button
                              key={slot.time}
                              type="button"
                              onClick={() => setNewTime(slot.time)}
                              disabled={!slot.available}
                              className={`h-11 rounded-lg border text-sm transition-all duration-200 ${
                                newTime === slot.time
                                  ? "text-white"
                                  : slot.available
                                    ? "border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50"
                                    : "border-gray-100 bg-gray-100 text-gray-400"
                              }`}
                              style={newTime === slot.time ? { backgroundColor: safeAccent, borderColor: safeAccent } : undefined}
                            >
                              {formatTime12(slot.time)}
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        onClick={() => setMode("view")}
                        type="button"
                        className="h-11 rounded-lg border border-gray-300 text-sm font-medium"
                      >
                        Back
                      </button>
                      <button
                        onClick={submitModify}
                        type="button"
                        disabled={busy || !newTime}
                        className="h-11 rounded-lg text-sm font-medium text-white transition-all duration-200 disabled:opacity-60"
                        style={{ backgroundColor: safeAccent }}
                      >
                        {busy ? "Saving..." : "Confirm Changes"}
                      </button>
                    </div>
                  </div>
                ) : mode === "confirm_cancel" ? (
                  <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
                    <p className="text-sm font-medium text-red-800">Are you sure you want to cancel this reservation?</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setMode("view")}
                        className="h-11 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700"
                      >
                        Go Back
                      </button>
                      <button
                        type="button"
                        onClick={submitCancel}
                        disabled={busy}
                        className="h-11 rounded-lg border border-red-300 bg-red-600 text-sm font-medium text-white transition-all duration-200 disabled:opacity-60"
                      >
                        {busy ? "Cancelling..." : "Confirm Cancellation"}
                      </button>
                    </div>
                  </div>
                ) : mode === "cancelled" ? (
                  <div className="space-y-3 rounded-lg border border-green-200 bg-green-50 p-4">
                    <p className="text-sm font-medium text-green-800">Your reservation has been cancelled.</p>
                    <p className="text-sm text-gray-700">Questions? Call us at {phone || "our restaurant"}{email ? ` or email ${email}` : ""}.</p>
                    <Link href="/" className="inline-flex text-sm font-medium" style={{ color: safeAccent }}>
                      Back to {restaurantName}
                    </Link>
                  </div>
                ) : mode === "modified" ? (
                  <div className="space-y-3 rounded-lg border border-green-200 bg-green-50 p-4">
                    <p className="text-sm font-medium text-green-800">Your reservation has been updated.</p>
                    <p className="text-sm text-gray-700">
                      Updated to {formatDateNice(newDate)} at {formatTime12(newTime)} for party of {newPartySize}.
                    </p>
                    <p className="text-sm text-gray-700">Questions? Call us at {phone || "our restaurant"}{email ? ` or email ${email}` : ""}.</p>
                    <Link href="/" className="inline-flex text-sm font-medium" style={{ color: safeAccent }}>
                      Done - Back to {restaurantName}
                    </Link>
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      onClick={() => setMode("modify")}
                      type="button"
                      className="h-11 rounded-lg text-sm font-medium text-white"
                      style={{ backgroundColor: safeAccent }}
                    >
                      Modify Reservation
                    </button>
                    <button
                      onClick={() => setMode("confirm_cancel")}
                      type="button"
                      className="h-11 rounded-lg border border-red-300 bg-red-50 text-sm font-medium text-red-700"
                    >
                      Cancel Reservation
                    </button>
                  </div>
                )}
              </div>
            )}

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>
        </div>

        <footer className="mt-4 space-y-2 text-center text-xs text-gray-500">
          <Link href="/" className="block text-sm text-gray-600 hover:text-gray-900">
            ← Back to {restaurantName}
          </Link>
          <div>Powered by ReserveSit</div>
          <div>
            <Link href={reserveLink} className="underline">Book a new reservation</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
