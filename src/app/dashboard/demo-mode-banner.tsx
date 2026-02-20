"use client";

import { useState } from "react";

export function DemoModeBanner() {
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resetDemo() {
    if (resetting) return;
    const confirmed = window.confirm("Reset all demo data to defaults?");
    if (!confirmed) return;

    setResetting(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/demo/reset", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof data?.error === "string" ? data.error : "Reset failed");
        return;
      }
      setMessage(typeof data?.message === "string" ? data.message : "Demo data reset to defaults");
      window.setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch {
      setError("Reset failed");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
      Demo mode: data resets daily.{" "}
      <a href="https://reservesit.com/pricing" className="font-semibold underline">
        Get your own instance →
      </a>
      <button
        onClick={resetDemo}
        disabled={resetting}
        className="ml-3 rounded border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {resetting ? "Resetting..." : "Reset Demo Data"}
      </button>
      {message ? <span className="ml-3 text-xs text-emerald-700">{message}</span> : null}
      {error ? <span className="ml-3 text-xs text-red-700">{error}</span> : null}
    </div>
  );
}
