"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface JoinResult {
  id: number;
  estimatedMinutes: number;
  partiesAhead: number;
}

interface WaitlistStatus {
  id: number;
  status: string;
  position: number;
  estimatedWait: number | null;
}

export default function WaitlistJoinPage() {
  const searchParams = useSearchParams();
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [preferredDate, setPreferredDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [joined, setJoined] = useState<JoinResult | null>(null);
  const [status, setStatus] = useState<WaitlistStatus | null>(null);
  const [estimate, setEstimate] = useState<{ estimatedMinutes: number; partiesAhead: number } | null>(null);

  useEffect(() => {
    const partySizeParam = Number(searchParams.get("partySize") || "");
    if (Number.isFinite(partySizeParam) && partySizeParam > 0) {
      setPartySize(String(Math.max(1, Math.trunc(partySizeParam))));
    }
    const dateParam = String(searchParams.get("date") || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      setPreferredDate(dateParam);
    }
  }, [searchParams]);

  useEffect(() => {
    const size = Math.max(1, parseInt(partySize, 10) || 1);
    fetch(`/api/waitlist/estimate?partySize=${size}`)
      .then(r => r.json())
      .then(data => setEstimate(data))
      .catch(() => setEstimate(null));
  }, [partySize]);

  useEffect(() => {
    if (!joined) return;
    const loadStatus = async () => {
      const res = await fetch(`/api/waitlist/status?id=${joined.id}&phone=${encodeURIComponent(guestPhone)}`);
      if (!res.ok) return;
      const data = await res.json();
      setStatus(data);
    };
    loadStatus();
    const timer = window.setInterval(loadStatus, 15000);
    return () => window.clearInterval(timer);
  }, [joined, guestPhone]);

  async function joinWaitlist(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName,
          guestPhone,
          partySize: Math.max(1, parseInt(partySize, 10) || 1),
          notes: preferredDate ? `Requested date: ${preferredDate}` : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to join waitlist");
        return;
      }
      setJoined({
        id: data.id,
        estimatedMinutes: Number(data.estimatedMinutes || 0),
        partiesAhead: Number(data.partiesAhead || 0),
      });
      setStatus({
        id: data.id,
        status: data.status || "waiting",
        position: Number(data.position || 0),
        estimatedWait: Number(data.estimatedWait || data.estimatedMinutes || 0),
      });
    } finally {
      setLoading(false);
    }
  }

  async function cancelSpot() {
    if (!joined) return;
    await fetch("/api/waitlist/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: joined.id, phone: guestPhone, action: "cancel" }),
    });
    setStatus(prev => (prev ? { ...prev, status: "cancelled" } : prev));
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Join the Waitlist</h1>
          <p className="text-sm text-gray-500">Get notified by text when your table is almost ready.</p>
        </div>

        {!joined ? (
          <form onSubmit={joinWaitlist} className="space-y-3">
            <input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Your name" className="h-11 w-full border rounded px-3" required />
            <input value={guestPhone} onChange={e => setGuestPhone(e.target.value)} placeholder="Phone number" className="h-11 w-full border rounded px-3" required />
            <input type="number" min={1} value={partySize} onChange={e => setPartySize(e.target.value)} placeholder="Party size" className="h-11 w-full border rounded px-3" required />
            <input type="date" value={preferredDate} onChange={e => setPreferredDate(e.target.value)} className="h-11 w-full border rounded px-3" />
            {estimate && <p className="text-xs text-gray-500">Current estimate: ~{estimate.estimatedMinutes} min · {estimate.partiesAhead} parties ahead</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading} className="w-full h-11 rounded bg-blue-600 text-white font-medium transition-all duration-200 disabled:opacity-60">
              {loading ? "Joining..." : "Join Waitlist"}
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border bg-gray-50 p-3">
              <p className="text-sm font-medium">
                You are #{status?.position || joined.partiesAhead + 1} in line · Estimated wait: ~{status?.estimatedWait ?? joined.estimatedMinutes} minutes
              </p>
              <p className="text-xs text-gray-500 mt-1">Status: {(status?.status || "waiting").replace("_", " ")}</p>
            </div>
            {status?.status === "notified" && (
              <div className="rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
                🎉 Your table is ready! Please head to the host stand.
              </div>
            )}
            {status?.status !== "cancelled" && status?.status !== "left" && (
              <button onClick={cancelSpot} className="w-full h-11 rounded border border-gray-300 text-sm font-medium transition-all duration-200">
                Cancel my spot
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
