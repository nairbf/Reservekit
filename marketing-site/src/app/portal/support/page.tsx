"use client";

import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "portal-support-tickets";

type Priority = "low" | "normal" | "high";

type TicketRecord = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  priority: Priority;
  createdAt: string;
};

type SessionResponse = {
  user?: {
    name?: string;
    email?: string;
  };
};

export default function PortalSupportPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as TicketRecord[];
      if (Array.isArray(parsed)) {
        setTickets(parsed);
      }
    } catch {
      // Ignore local storage parsing failures.
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSession() {
      try {
        const res = await fetch("/api/auth/me", { signal: controller.signal });
        if (!res.ok) return;
        const payload = (await res.json()) as SessionResponse;
        if (payload.user?.name) setName(payload.user.name);
        if (payload.user?.email) setEmail(payload.user.email);
      } catch {
        // Best-effort prefill only.
      }
    }

    void loadSession();
    return () => controller.abort();
  }, []);

  const sortedTickets = useMemo(
    () => [...tickets].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [tickets],
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    setSubmitting(true);

    try {
      const payload = {
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
        priority,
      };

      const res = await fetch("/api/support-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error || "Ticket submission failed.");
      }

      const ticket: TicketRecord = {
        id: `SUP-${Date.now()}`,
        ...payload,
        createdAt: new Date().toISOString(),
      };

      setTickets((prev) => {
        const next = [ticket, ...prev];
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });

      setSubject("");
      setMessage("");
      setPriority("normal");
      setStatus({ kind: "success", text: "Ticket submitted! We'll respond within 24 hours to your email." });
    } catch (error) {
      setStatus({
        kind: "error",
        text: error instanceof Error ? error.message : "Ticket submission failed.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-16 sm:px-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Support</h1>
        <p className="mt-1 text-sm text-slate-600">Submit a support ticket and track your submitted requests.</p>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Subject</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Message</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Priority</span>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="h-11 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submitting ? "Submitting..." : "Submit Ticket"}
        </button>

        {status ? (
          <p className={`text-sm ${status.kind === "success" ? "text-emerald-700" : "text-rose-700"}`}>
            {status.text}
          </p>
        ) : null}
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Submitted Tickets</h2>
        {sortedTickets.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No support tickets yet. Need help? Submit a ticket below.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {sortedTickets.map((ticket) => (
              <div key={ticket.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{ticket.subject}</p>
                  <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium uppercase text-slate-700">
                    {ticket.priority}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{new Date(ticket.createdAt).toLocaleString()}</p>
                <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{ticket.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
