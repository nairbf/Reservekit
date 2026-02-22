"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import AccessDenied from "@/components/access-denied";
import { useHasPermission } from "@/hooks/use-permissions";

interface WaitlistEntry {
  id: number;
  guestName: string;
  guestPhone: string;
  guestEmail: string | null;
  partySize: number;
  estimatedWait: number | null;
  status: string;
  position: number;
  quotedAt: string;
  notifiedAt: string | null;
  seatedAt: string | null;
  notes: string | null;
  updatedAt: string;
}

interface AddFormState {
  guestName: string;
  guestPhone: string;
  partySize: string;
  notes: string;
}

interface SmartEstimate {
  estimatedMinutes: number;
  estimatedTime: string;
  smart: boolean;
}

function statusClass(status: string): string {
  if (status === "waiting") return "bg-white border-gray-200";
  if (status === "notified") return "bg-yellow-50 border-yellow-300 animate-pulse";
  if (status === "seated") return "bg-green-50 border-green-300";
  return "bg-gray-100 border-gray-200";
}

function elapsedMinutes(iso: string): number {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - dt.getTime()) / 60000));
}

export default function WaitlistPage() {
  const canManageWaitlist = useHasPermission("manage_waitlist");
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [smartEstimates, setSmartEstimates] = useState<Record<number, SmartEstimate>>({});
  const [smartWaitlistEnabled, setSmartWaitlistEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState<{ id: number; action: "notify" | "seat" | "remove" | "cancel" } | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [form, setForm] = useState<AddFormState>({
    guestName: "",
    guestPhone: "",
    partySize: "2",
    notes: "",
  });

  const loadSmartEstimates = useCallback(async (rows: WaitlistEntry[]) => {
    const activeRows = rows
      .filter((row) => ["waiting", "notified"].includes(row.status))
      .sort((a, b) => a.position - b.position || a.id - b.id);

    if (activeRows.length === 0) {
      setSmartEstimates({});
      setSmartWaitlistEnabled(false);
      return;
    }

    try {
      const pairs = await Promise.all(
        activeRows.map(async (row) => {
          const response = await fetch(
            `/api/waitlist/estimate?partySize=${row.partySize}&position=${Math.max(1, row.position)}`,
          );
          if (!response.ok) return [row.id, null] as const;
          const payload = await response.json();
          const estimate: SmartEstimate = {
            estimatedMinutes: Math.max(0, Number(payload.estimatedMinutes || 0)),
            estimatedTime: String(payload.estimatedTime || ""),
            smart: Boolean(payload.smart),
          };
          return [row.id, estimate] as const;
        }),
      );

      const nextEstimates: Record<number, SmartEstimate> = {};
      let enabled = false;
      for (const [entryId, estimate] of pairs) {
        if (!estimate) continue;
        nextEstimates[entryId] = estimate;
        if (estimate.smart) enabled = true;
      }

      setSmartEstimates(nextEstimates);
      setSmartWaitlistEnabled(enabled);
    } catch {
      setSmartEstimates({});
      setSmartWaitlistEnabled(false);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/waitlist");
      if (!res.ok) {
        setError("Failed to load waitlist.");
        return;
      }
      const data = await res.json();
      const rows = Array.isArray(data) ? data : [];
      setEntries(rows);
      setError("");
      loadSmartEstimates(rows).catch(() => undefined);
    } catch {
      setError("Failed to load waitlist.");
    } finally {
      setLoading(false);
    }
  }, [loadSmartEstimates]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 10000);
    return () => window.clearInterval(timer);
  }, [load]);

  const visibleEntries = useMemo(() => {
    const now = Date.now();
    return entries
      .filter(entry => {
        if (!["left", "cancelled"].includes(entry.status)) return true;
        const updated = new Date(entry.updatedAt).getTime();
        return Number.isFinite(updated) ? now - updated < 5 * 60 * 1000 : false;
      })
      .sort((a, b) => a.position - b.position || a.id - b.id);
  }, [entries]);

  const waitingEntries = visibleEntries.filter(e => e.status === "waiting");
  const longestWait = waitingEntries.reduce((max, entry) => {
    const smartEstimate = smartEstimates[entry.id];
    if (smartWaitlistEnabled && smartEstimate?.smart) {
      return Math.max(max, smartEstimate.estimatedMinutes);
    }
    return Math.max(max, entry.estimatedWait || 0);
  }, 0);

  if (!canManageWaitlist) return <AccessDenied />;

  async function updateStatus(id: number, action: "notify" | "seat" | "remove" | "cancel") {
    if (actionBusy) return;
    if (action === "remove" && !confirm("Remove this guest from the waitlist?")) return;
    if (action === "seat" && !confirm("Seat this waitlist guest now?")) return;

    setActionBusy({ id, action });
    setStatusMessage("");
    setError("");
    const payload: Record<string, unknown> = { action };
    if (action === "seat") payload.createReservation = true;
    try {
      const response = await fetch(`/api/waitlist/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(String((data as { error?: string })?.error || "Failed to update waitlist status."));
        return;
      }
      setStatusMessage(
        action === "notify"
          ? "Guest notified."
          : action === "seat"
            ? "Guest seated and reservation created."
            : "Guest removed from waitlist.",
      );
      await load();
    } catch {
      setError("Failed to update waitlist status.");
    } finally {
      setActionBusy(null);
    }
  }

  async function addToWaitlist(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatusMessage("");
    setError("");
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName: form.guestName,
          guestPhone: form.guestPhone,
          partySize: Math.max(1, parseInt(form.partySize, 10) || 1),
          notes: form.notes || null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(String((data as { error?: string })?.error || "Unable to add waitlist party."));
        return;
      }
      setForm({ guestName: "", guestPhone: "", partySize: "2", notes: "" });
      setShowAdd(false);
      setStatusMessage("Added to waitlist.");
      await load();
    } catch {
      setError("Unable to add waitlist party.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-gray-500">
        <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
        Loading waitlist...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => load()}
            className="h-8 rounded border border-red-200 bg-white px-3 text-xs font-medium text-red-700"
          >
            Retry
          </button>
        </div>
      ) : null}
      {statusMessage ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {statusMessage}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Waitlist</h1>
          <p className="text-sm text-gray-500">{waitingEntries.length} parties waiting · Est. longest wait: {longestWait} min</p>
        </div>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="h-11 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium transition-all duration-200"
        >
          {showAdd ? "Close" : "Add to Waitlist"}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={addToWaitlist} className="bg-white rounded-xl shadow p-4 sm:p-6 grid sm:grid-cols-2 gap-3">
          <input
            value={form.guestName}
            onChange={e => setForm(prev => ({ ...prev, guestName: e.target.value }))}
            placeholder="Guest name"
            className="h-11 border rounded px-3"
            required
          />
          <input
            value={form.guestPhone}
            onChange={e => setForm(prev => ({ ...prev, guestPhone: e.target.value }))}
            placeholder="Phone"
            className="h-11 border rounded px-3"
            required
          />
          <input
            type="number"
            min={1}
            value={form.partySize}
            onChange={e => setForm(prev => ({ ...prev, partySize: e.target.value }))}
            placeholder="Party size"
            className="h-11 border rounded px-3"
            required
          />
          <input
            value={form.notes}
            onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Notes (optional)"
            className="h-11 border rounded px-3"
          />
          <button
            type="submit"
            disabled={saving}
            className="sm:col-span-2 h-11 rounded-lg bg-gray-900 text-white text-sm font-medium transition-all duration-200 disabled:opacity-60"
          >
            {saving ? "Adding..." : "Add Party"}
          </button>
        </form>
      )}

      {visibleEntries.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">No waitlist entries right now.</div>
      ) : (
        <div className="space-y-3">
          {visibleEntries.map(entry => (
            <div key={entry.id} className={`rounded-xl border shadow-sm p-4 sm:p-5 transition-all duration-200 ${statusClass(entry.status)}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-gray-500">#{entry.position}</div>
                  <div className="text-lg font-bold">{entry.guestName}</div>
                  <div className="text-sm text-gray-600">Party of {entry.partySize} · waiting {elapsedMinutes(entry.quotedAt)} min</div>
                  {smartWaitlistEnabled && smartEstimates[entry.id]?.smart ? (
                    <div className="text-xs text-gray-500 mt-1">
                      Est. ~{smartEstimates[entry.id].estimatedMinutes} min ({smartEstimates[entry.id].estimatedTime})
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 mt-1">Est. wait: {entry.estimatedWait ?? 0} min</div>
                  )}
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-white border capitalize">{entry.status.replace("_", " ")}</span>
              </div>
              {entry.notes && <div className="text-sm text-gray-600 mt-2">{entry.notes}</div>}
              <div className="mt-3 flex flex-wrap gap-2">
                {entry.status === "waiting" && (
                  <button
                    onClick={() => updateStatus(entry.id, "notify")}
                    className="h-11 px-4 rounded bg-yellow-50 text-yellow-800 border border-yellow-200 text-sm transition-all duration-200 disabled:opacity-60"
                    disabled={Boolean(actionBusy)}
                  >
                    {actionBusy?.id === entry.id && actionBusy.action === "notify" ? "Notifying..." : "Notify"}
                  </button>
                )}
                {["waiting", "notified"].includes(entry.status) && (
                  <button
                    onClick={() => updateStatus(entry.id, "seat")}
                    className="h-11 px-4 rounded bg-green-50 text-green-800 border border-green-200 text-sm transition-all duration-200 disabled:opacity-60"
                    disabled={Boolean(actionBusy)}
                  >
                    {actionBusy?.id === entry.id && actionBusy.action === "seat" ? "Seating..." : "Seat"}
                  </button>
                )}
                {["waiting", "notified"].includes(entry.status) && (
                  <button
                    onClick={() => updateStatus(entry.id, "remove")}
                    className="h-11 px-4 rounded bg-gray-100 text-gray-700 border border-gray-200 text-sm transition-all duration-200 disabled:opacity-60"
                    disabled={Boolean(actionBusy)}
                  >
                    {actionBusy?.id === entry.id && actionBusy.action === "remove" ? "Removing..." : "Remove"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
