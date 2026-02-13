"use client";

import { useState } from "react";

const mockTickets = [
  { id: "SUP-1001", subject: "Need DNS update", priority: "Medium", status: "Open", createdAt: "2026-02-02" },
  { id: "SUP-0998", subject: "Invoice copy", priority: "Low", status: "Resolved", createdAt: "2026-01-15" },
];

export default function PortalSupportPage() {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    try {
      const res = await fetch("/api/support-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, description, priority }),
      });
      if (!res.ok) throw new Error("Failed to create ticket");
      setSubject("");
      setDescription("");
      setPriority("Medium");
      setSuccess(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-16 sm:px-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Support</h1>
        <p className="mt-1 text-sm text-slate-600">Open a support request and track prior tickets.</p>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Subject</span>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} required className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Description</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Priority</span>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm">
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
        </label>

        <button type="submit" disabled={loading} className="h-11 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60">
          {loading ? "Submitting..." : "Submit Ticket"}
        </button>

        {success ? <p className="text-sm text-emerald-700">Support ticket submitted.</p> : null}
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Past Tickets</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2">Ticket</th>
                <th className="px-4 py-2">Subject</th>
                <th className="px-4 py-2">Priority</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {mockTickets.map((ticket) => (
                <tr key={ticket.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium text-slate-900">{ticket.id}</td>
                  <td className="px-4 py-2 text-slate-700">{ticket.subject}</td>
                  <td className="px-4 py-2 text-slate-700">{ticket.priority}</td>
                  <td className="px-4 py-2 text-slate-700">{ticket.status}</td>
                  <td className="px-4 py-2 text-slate-700">{ticket.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
