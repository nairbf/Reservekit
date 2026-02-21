"use client";

import { useEffect, useMemo, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

interface EventData {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  date: string;
  startTime: string;
  endTime: string | null;
  ticketPrice: number;
  maxTickets: number;
  soldTickets: number;
  slug: string;
  remainingTickets: number;
  soldOut: boolean;
}

interface PurchasedTicket {
  id: number;
  code: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string | null;
  status: string;
  quantity: number;
  totalPaid: number;
}

const ENV_STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || null;

function formatTime12(value: string): string {
  const [h, m] = String(value || "00:00").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return value;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function formatDate(value: string): string {
  const dt = new Date(`${value}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function PaymentConfirm({
  onConfirm,
  onBack,
  processing,
  setProcessing,
  onError,
}: {
  onConfirm: () => Promise<void>;
  onBack: () => void;
  processing: boolean;
  setProcessing: (v: boolean) => void;
  onError: (msg: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    onError("");
    try {
      const result = await stripe.confirmPayment({ elements, redirect: "if_required" });
      if (result.error) {
        onError(result.error.message || "Payment failed.");
        return;
      }
      const status = result.paymentIntent?.status;
      if (status !== "succeeded") {
        onError("Payment has not completed yet.");
        return;
      }
      await onConfirm();
    } finally {
      setProcessing(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="rounded-lg border border-gray-200 p-3">
        <PaymentElement options={{ layout: "tabs" }} />
      </div>
      <button
        type="submit"
        disabled={processing || !stripe || !elements}
        className="w-full h-11 rounded bg-blue-600 text-white font-medium transition-all duration-200 disabled:opacity-60"
      >
        {processing ? "Processing..." : "Purchase Tickets"}
      </button>
      <button
        type="button"
        onClick={onBack}
        className="w-full h-11 rounded border border-gray-200 text-gray-700 font-medium transition-all duration-200"
      >
        Back
      </button>
    </form>
  );
}

export function EventDetailPageClient({ slug }: { slug: string }) {

  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState({ guestName: "", guestEmail: "", guestPhone: "", quantity: 1 });
  const [step, setStep] = useState<"form" | "payment" | "done">("form");
  const [processing, setProcessing] = useState(false);

  const [clientSecret, setClientSecret] = useState("");
  const [paymentIntentId, setPaymentIntentId] = useState("");
  const [tickets, setTickets] = useState<PurchasedTicket[]>([]);
  const [calendarIcs, setCalendarIcs] = useState("");
  const [stripePublishableKey, setStripePublishableKey] = useState<string | null>(ENV_STRIPE_PUBLISHABLE_KEY);

  const stripePromise = useMemo(
    () => (stripePublishableKey ? loadStripe(stripePublishableKey) : null),
    [stripePublishableKey],
  );

  useEffect(() => {
    let mounted = true;
    fetch("/api/payments/deposit-config")
      .then(async (response) => {
        if (!response.ok) return null;
        const data = (await response.json().catch(() => ({}))) as { stripePublishableKey?: string };
        return String(data.stripePublishableKey || "").trim() || null;
      })
      .then((key) => {
        if (!mounted || !key) return;
        setStripePublishableKey(key);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`/api/events/by-slug/${encodeURIComponent(slug)}`)
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Event not found");
        return data as EventData;
      })
      .then(data => setEvent(data))
      .catch(err => setError(err.message || "Event not found"))
      .finally(() => setLoading(false));
  }, [slug]);

  const maxSelectable = useMemo(
    () => Math.max(1, Math.min(10, event?.remainingTickets || 1)),
    [event?.remainingTickets],
  );

  const total = useMemo(
    () => (event?.ticketPrice || 0) * form.quantity,
    [event?.ticketPrice, form.quantity],
  );

  const stripeEnabled = Boolean(stripePromise);
  const requiresStripe = Boolean(event && event.ticketPrice > 0 && stripeEnabled);
  const paidEventWithoutCheckout = Boolean(event && event.ticketPrice > 0 && !stripeEnabled);

  async function reserveWithoutPayment() {
    if (!event) return;
    setProcessing(true);
    setError("");
    try {
      const res = await fetch(`/api/events/${event.id}/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName: form.guestName,
          guestEmail: form.guestEmail,
          guestPhone: form.guestPhone,
          quantity: form.quantity,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to reserve tickets.");
        return;
      }
      setTickets(Array.isArray(data.tickets) ? data.tickets : []);
      setCalendarIcs(String(data.calendarIcs || ""));
      setStep("done");
      setEvent(prev => (prev
        ? { ...prev, soldTickets: prev.soldTickets + form.quantity, remainingTickets: Math.max(0, prev.remainingTickets - form.quantity), soldOut: Math.max(0, prev.remainingTickets - form.quantity) <= 0 }
        : prev));
    } finally {
      setProcessing(false);
    }
  }

  async function beginStripePurchase(e: React.FormEvent) {
    e.preventDefault();
    if (!event) return;
    if (paidEventWithoutCheckout) {
      setError("Online ticket sales are not available at this time. Please contact the restaurant directly.");
      return;
    }
    if (!requiresStripe) {
      await reserveWithoutPayment();
      return;
    }

    setProcessing(true);
    setError("");
    try {
      const res = await fetch(`/api/events/${event.id}/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName: form.guestName,
          guestEmail: form.guestEmail,
          guestPhone: form.guestPhone,
          quantity: form.quantity,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.clientSecret || !data.paymentIntentId) {
        setError(data.error || "Unable to start checkout.");
        return;
      }

      setClientSecret(String(data.clientSecret));
      setPaymentIntentId(String(data.paymentIntentId));
      setStep("payment");
    } finally {
      setProcessing(false);
    }
  }

  async function finalizeStripePurchase() {
    if (!event || !paymentIntentId) return;

    const res = await fetch(`/api/events/${event.id}/purchase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentIntentId,
        guestName: form.guestName,
        guestEmail: form.guestEmail,
        guestPhone: form.guestPhone,
        quantity: form.quantity,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Unable to finalize purchase.");
      return;
    }

    setTickets(Array.isArray(data.tickets) ? data.tickets : []);
    setCalendarIcs(String(data.calendarIcs || ""));
    setStep("done");
    setEvent(prev => (prev
      ? { ...prev, soldTickets: prev.soldTickets + form.quantity, remainingTickets: Math.max(0, prev.remainingTickets - form.quantity), soldOut: Math.max(0, prev.remainingTickets - form.quantity) <= 0 }
      : prev));
  }

  function downloadCalendar() {
    if (!event || !calendarIcs) return;
    const blob = new Blob([calendarIcs], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event.slug}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-10">
        <div className="max-w-3xl mx-auto flex items-center gap-3 text-gray-500">
          <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
          Loading event...
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-10">
        <div className="max-w-3xl mx-auto bg-white rounded-xl shadow p-8 text-center text-gray-500">{error || "Event not found."}</div>
      </div>
    );
  }

  const soldOut = event.soldOut || event.remainingTickets <= 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-slate-100 px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="bg-white rounded-2xl shadow p-6">
          <div className="mb-4 h-52 w-full overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-slate-200">
            {event.imageUrl ? (
              <img
                src={event.imageUrl}
                alt={event.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-medium text-slate-500">
                Event Preview
              </div>
            )}
          </div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold">{event.name}</h1>
              <p className="text-sm text-gray-500 mt-1">{formatDate(event.date)} · {formatTime12(event.startTime)}{event.endTime ? ` - ${formatTime12(event.endTime)}` : ""}</p>
            </div>
            {soldOut ? (
              <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">Sold Out</span>
            ) : (
              <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">{event.remainingTickets} tickets left</span>
            )}
          </div>
          {event.description && <p className="mt-3 text-gray-700">{event.description}</p>}
          <div className="mt-4 font-semibold">Ticket price: ${(event.ticketPrice / 100).toFixed(2)}</div>
        </div>

        {step === "done" ? (
          <div className="bg-white rounded-2xl shadow p-6 space-y-4">
            <h2 className="text-xl font-bold">🎉 You're in! Tickets confirmed.</h2>
            <p className="text-sm text-gray-600">Save this page — you'll need your ticket code at the door.</p>
            <div className="rounded-lg border p-3 bg-gray-50">
              <p className="text-sm font-semibold mb-2">Your ticket code{tickets.length === 1 ? "" : "s"}:</p>
              <ul className="space-y-1">
                {tickets.map(ticket => (
                  <li key={ticket.id} className="font-mono text-sm">{ticket.code}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border p-3 text-sm">
              <p><span className="font-medium">Event:</span> {event.name}</p>
              <p><span className="font-medium">Date:</span> {formatDate(event.date)}</p>
              <p><span className="font-medium">Time:</span> {formatTime12(event.startTime)}{event.endTime ? ` - ${formatTime12(event.endTime)}` : ""}</p>
            </div>
            <button
              onClick={downloadCalendar}
              className="h-11 px-4 rounded bg-blue-600 text-white text-sm font-medium transition-all duration-200"
            >
              Add to Calendar
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow p-6 space-y-3">
            {soldOut ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="font-semibold text-red-700">This event is sold out.</p>
                <p className="mt-1 text-sm text-red-700/80">
                  Tickets are currently unavailable. Check back later in case additional spots open.
                </p>
              </div>
            ) : step === "form" ? (
              <form onSubmit={beginStripePurchase} className="space-y-3">
                <input
                  value={form.guestName}
                  onChange={e => setForm(prev => ({ ...prev, guestName: e.target.value }))}
                  placeholder="Full name"
                  className="h-11 w-full border rounded px-3"
                  required
                />
                <input
                  type="email"
                  value={form.guestEmail}
                  onChange={e => setForm(prev => ({ ...prev, guestEmail: e.target.value }))}
                  placeholder="Email"
                  className="h-11 w-full border rounded px-3"
                  required
                />
                <input
                  value={form.guestPhone}
                  onChange={e => setForm(prev => ({ ...prev, guestPhone: e.target.value }))}
                  placeholder="Phone"
                  className="h-11 w-full border rounded px-3"
                />
                <label className="block text-sm font-medium">
                  Quantity
                  <select
                    value={form.quantity}
                    onChange={e => setForm(prev => ({ ...prev, quantity: Math.max(1, Number(e.target.value)) }))}
                    className="mt-1 h-11 w-full border rounded px-3"
                  >
                    {Array.from({ length: maxSelectable }).map((_, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1}</option>
                    ))}
                  </select>
                </label>
                <div className="text-sm text-gray-600">Total: ${(total / 100).toFixed(2)}</div>

                <button
                  type="submit"
                  disabled={processing || paidEventWithoutCheckout}
                  className="w-full h-11 rounded bg-blue-600 text-white font-medium transition-all duration-200 disabled:opacity-60"
                >
                  {processing
                    ? "Please wait..."
                    : paidEventWithoutCheckout
                      ? "Unavailable"
                    : requiresStripe
                      ? "Continue to Payment"
                      : "Reserve Tickets"}
                </button>

                {paidEventWithoutCheckout && (
                  <p className="text-xs text-red-600">
                    Online ticket sales are not available at this time. Please contact the restaurant directly.
                  </p>
                )}
              </form>
            ) : (
              <>
                <p className="text-sm text-gray-600">Total: ${(total / 100).toFixed(2)}</p>
                {!stripePromise || !clientSecret ? (
                  <p className="text-sm text-red-600">Unable to load card form.</p>
                ) : (
                  <Elements stripe={stripePromise} options={{ clientSecret }}>
                    <PaymentConfirm
                      processing={processing}
                      setProcessing={setProcessing}
                      onConfirm={finalizeStripePurchase}
                      onError={setError}
                      onBack={() => setStep("form")}
                    />
                  </Elements>
                )}
              </>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
