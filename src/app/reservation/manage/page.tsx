"use client";
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

function formatTime12(value: string): string {
  const [h, m] = String(value || "00:00").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return value;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export default function ReservationManagePage() {
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [lookup, setLookup] = useState<ReservationLookup | null>(null);
  const [error, setError] = useState("");
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [mode, setMode] = useState<"view" | "modify" | "cancelled" | "modified">("view");
  const [newDate, setNewDate] = useState("");
  const [newPartySize, setNewPartySize] = useState(2);
  const [newTime, setNewTime] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [busy, setBusy] = useState(false);

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
      .then(r => r.json())
      .then(data => setSlots(Array.isArray(data.slots) ? data.slots : []))
      .finally(() => setLoadingSlots(false));
  }, [mode, newDate, newPartySize]);

  const isTerminal = useMemo(() => {
    if (!lookup) return false;
    return ["cancelled", "completed", "no_show"].includes(lookup.status);
  }, [lookup]);

  async function runLookup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoadingLookup(true);
    try {
      const res = await fetch(`/api/reservations/lookup?code=${encodeURIComponent(code)}&phone=${encodeURIComponent(phone)}`);
      const data = await res.json();
      if (!res.ok) {
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
      const res = await fetch("/api/reservations/self-service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: lookup.code, phone, action: "cancel" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to cancel reservation.");
        return;
      }
      setLookup(prev => (prev ? { ...prev, status: "cancelled" } : prev));
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
      const res = await fetch("/api/reservations/self-service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: lookup.code,
          phone,
          action: "modify",
          newDate,
          newTime,
          newPartySize,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to modify reservation.");
        return;
      }
      setLookup(prev => prev ? { ...prev, date: newDate, time: newTime, partySize: newPartySize } : prev);
      setMode("modified");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-xl mx-auto bg-white rounded-xl shadow p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Manage Reservation</h1>
          <p className="text-sm text-gray-500">Look up your reservation to modify or cancel.</p>
        </div>

        {!lookup && (
          <form onSubmit={runLookup} className="space-y-3">
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="Reservation code (e.g. RS-A1B2)" className="h-11 w-full border rounded px-3" required />
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number" className="h-11 w-full border rounded px-3" required />
            <button type="submit" disabled={loadingLookup} className="w-full h-11 rounded bg-blue-600 text-white font-medium transition-all duration-200 disabled:opacity-60">
              {loadingLookup ? "Looking up..." : "Find Reservation"}
            </button>
          </form>
        )}

        {lookup && (
          <div className="space-y-3">
            <div className="rounded-lg border p-3 bg-gray-50">
              <div className="text-sm text-gray-500">Reservation</div>
              <div className="font-semibold">{lookup.guestName}</div>
              <div className="text-sm text-gray-600">{lookup.date} at {formatTime12(lookup.time)} · Party of {lookup.partySize}</div>
              <div className="text-xs text-gray-500 mt-1">Status: {lookup.status.replace("_", " ")}</div>
            </div>

            {isTerminal ? (
              <p className="text-sm text-gray-600">This reservation is already {lookup.status.replace("_", " ")}.</p>
            ) : mode === "modify" ? (
              <div className="space-y-3">
                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="h-11 w-full border rounded px-3" />
                <input type="number" min={1} value={newPartySize} onChange={e => setNewPartySize(Math.max(1, Number(e.target.value) || 1))} className="h-11 w-full border rounded px-3" />
                {loadingSlots ? (
                  <p className="text-sm text-gray-500">Loading available times...</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {slots.map(slot => (
                      <button
                        key={slot.time}
                        type="button"
                        onClick={() => setNewTime(slot.time)}
                        disabled={!slot.available}
                        className={`h-11 rounded text-sm border transition-all duration-200 ${newTime === slot.time ? "bg-blue-600 text-white border-blue-600" : slot.available ? "bg-white border-gray-200" : "bg-gray-100 text-gray-400 border-gray-100"}`}
                      >
                        {formatTime12(slot.time)}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => setMode("view")} type="button" className="flex-1 h-11 rounded border border-gray-300 text-sm font-medium">Back</button>
                  <button onClick={submitModify} type="button" disabled={busy || !newTime} className="flex-1 h-11 rounded bg-blue-600 text-white text-sm font-medium transition-all duration-200 disabled:opacity-60">{busy ? "Saving..." : "Confirm Changes"}</button>
                </div>
              </div>
            ) : mode === "cancelled" ? (
              <p className="text-sm text-green-700">Your reservation has been cancelled.</p>
            ) : mode === "modified" ? (
              <p className="text-sm text-green-700">Your reservation has been updated.</p>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setMode("modify")} className="flex-1 h-11 rounded bg-blue-600 text-white text-sm font-medium transition-all duration-200">Modify Reservation</button>
                <button onClick={submitCancel} disabled={busy} className="flex-1 h-11 rounded border border-red-300 text-red-700 text-sm font-medium transition-all duration-200 disabled:opacity-60">{busy ? "Cancelling..." : "Cancel Reservation"}</button>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
