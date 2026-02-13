"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SaveHandler = (patch: Record<string, string>) => Promise<void> | void;

export default function MenuSettings({
  settings,
  onSave,
}: {
  settings: Record<string, string>;
  onSave: SaveHandler;
}) {
  const [showPreview, setShowPreview] = useState((settings.menuPreviewEnabled || "true") === "true");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setShowPreview((settings.menuPreviewEnabled || "true") === "true");
  }, [settings]);

  async function saveSection() {
    setSaving(true);
    setMessage("");
    try {
      await onSave({ menuPreviewEnabled: showPreview ? "true" : "false" });
      setMessage("Menu settings saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <p className="text-sm text-gray-700">
        Menu content is managed in the Menu page.
      </p>
      <Link href="/dashboard/menu" className="inline-flex h-10 items-center rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700">
        Open Menu Manager
      </Link>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={showPreview} onChange={(e) => setShowPreview(e.target.checked)} className="h-4 w-4" />
        Show menu preview on landing page
      </label>
      <div className="flex items-center gap-3">
        <button onClick={saveSection} disabled={saving} className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-70">
          {saving ? "Saving..." : "Save Menu Section"}
        </button>
        {message ? <span className="text-sm text-green-700">{message}</span> : null}
      </div>
    </div>
  );
}
