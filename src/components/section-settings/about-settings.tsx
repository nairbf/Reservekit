"use client";

import { useEffect, useState } from "react";

type SaveHandler = (patch: Record<string, string>) => Promise<void> | void;

export default function AboutSettings({
  settings,
  onSave,
}: {
  settings: Record<string, string>;
  onSave: SaveHandler;
}) {
  const [welcomeHeading, setWelcomeHeading] = useState(settings.welcomeHeading || "A dining room built for meaningful evenings.");
  const [description, setDescription] = useState(settings.description || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setWelcomeHeading(settings.welcomeHeading || "A dining room built for meaningful evenings.");
    setDescription(settings.description || "");
  }, [settings]);

  async function saveSection() {
    setSaving(true);
    setMessage("");
    try {
      await onSave({ welcomeHeading, description });
      setMessage("About settings saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div>
        <label className="mb-1 block text-sm font-medium">Welcome heading</label>
        <input value={welcomeHeading} onChange={(e) => setWelcomeHeading(e.target.value)} className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
      </div>
      <div className="flex items-center gap-3">
        <button onClick={saveSection} disabled={saving} className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-70">
          {saving ? "Saving..." : "Save About"}
        </button>
        {message ? <span className="text-sm text-green-700">{message}</span> : null}
      </div>
    </div>
  );
}
