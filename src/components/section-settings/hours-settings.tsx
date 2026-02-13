"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SaveHandler = (patch: Record<string, string>) => Promise<void> | void;

export default function HoursSettings({
  settings,
  onSave,
}: {
  settings: Record<string, string>;
  onSave: SaveHandler;
}) {
  const defaultShowAddress = settings.address ? "true" : "false";
  const [showAddress, setShowAddress] = useState((settings.hoursShowAddress || defaultShowAddress) === "true");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fallback = settings.address ? "true" : "false";
    setShowAddress((settings.hoursShowAddress || fallback) === "true");
  }, [settings]);

  async function saveSection() {
    setSaving(true);
    setMessage("");
    try {
      await onSave({ hoursShowAddress: showAddress ? "true" : "false" });
      setMessage("Hours settings saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <p className="text-sm text-gray-700">Hours are managed in the Schedule page.</p>
      <Link href="/dashboard/schedule" className="inline-flex h-10 items-center rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700">
        Open Schedule Manager
      </Link>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={showAddress} onChange={(e) => setShowAddress(e.target.checked)} className="h-4 w-4" />
        Show address in Hours & Location section
      </label>
      <div className="flex items-center gap-3">
        <button onClick={saveSection} disabled={saving} className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-70">
          {saving ? "Saving..." : "Save Hours Section"}
        </button>
        {message ? <span className="text-sm text-green-700">{message}</span> : null}
      </div>
    </div>
  );
}
