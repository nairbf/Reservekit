"use client";

import { useState } from "react";

export function DemoForm() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    restaurantName: "",
    contactName: "",
    email: "",
    phone: "",
    message: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed to submit request");
      setSuccess(true);
      setForm({ restaurantName: "", contactName: "", email: "", phone: "", message: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit request");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        Thanks. Your demo request was submitted. We will reach out shortly.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Restaurant Name</span>
          <input value={form.restaurantName} onChange={(e) => setForm((p) => ({ ...p, restaurantName: e.target.value }))} required className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Contact Name</span>
          <input value={form.contactName} onChange={(e) => setForm((p) => ({ ...p, contactName: e.target.value }))} required className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Email</span>
          <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} required className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Phone (optional)</span>
          <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Message (optional)</span>
        <textarea value={form.message} onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))} rows={4} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </label>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <button type="submit" disabled={loading} className="h-11 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition-all duration-200 hover:bg-blue-700 disabled:opacity-60">
        {loading ? "Submitting..." : "Request Demo"}
      </button>
    </form>
  );
}
