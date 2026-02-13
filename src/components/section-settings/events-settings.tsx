"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SaveHandler = (patch: Record<string, string>) => Promise<void> | void;

export default function EventsSettings({
  settings,
  onSave,
}: {
  settings: Record<string, string>;
  onSave: SaveHandler;
}) {
  const [maxEvents, setMaxEvents] = useState(settings.eventsMaxCount || "4");
  const [autoHide, setAutoHide] = useState((settings.eventsAutoHideWhenEmpty || "true") === "true");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setMaxEvents(settings.eventsMaxCount || "4");
    setAutoHide((settings.eventsAutoHideWhenEmpty || "true") === "true");
  }, [settings]);

  async function saveSection() {
    setSaving(true);
    setMessage("");
    try {
      await onSave({
        eventsMaxCount: String(Math.max(1, Math.min(12, parseInt(maxEvents || "4", 10) || 4))),
        eventsAutoHideWhenEmpty: autoHide ? "true" : "false",
      });
      setMessage("Events settings saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <p className="text-sm text-gray-700">Events are managed in the Events page.</p>
      <Link href="/dashboard/events" className="inline-flex h-10 items-center rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700">
        Open Events Manager
      </Link>
      <div>
        <label className="mb-1 block text-sm font-medium">Max events to show</label>
        <input type="number" min={1} max={12} value={maxEvents} onChange={(e) => setMaxEvents(e.target.value)} className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm" />
      </div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={autoHide} onChange={(e) => setAutoHide(e.target.checked)} className="h-4 w-4" />
        Auto-hide when no upcoming events
      </label>
      <div className="flex items-center gap-3">
        <button onClick={saveSection} disabled={saving} className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-70">
          {saving ? "Saving..." : "Save Events Section"}
        </button>
        {message ? <span className="text-sm text-green-700">{message}</span> : null}
      </div>
    </div>
  );
}
