"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

interface EventData {
  id: number;
  name: string;
  description: string | null;
  date: string;
  startTime: string;
  endTime: string | null;
  ticketPrice: number;
  maxTickets: number;
  soldTickets: number;
  isActive: boolean;
  slug: string;
  remainingTickets: number;
  soldOut: boolean;
}

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

function formatTime12(value: string): string {
  const [h, m] = String(value || "00:00").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return value;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function CheckoutForm({
  processing,
  onProcessing,
  onConfirm,
  onError,
}: {
  processing: boolean;
  onProcessing: (v: boolean) => void;
  onConfirm: () => Promise<void>;
  onError: (msg: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    onProcessing(true);
    onError("");
    try {
      const result = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
      });
      if (result.error) {
        onError(result.error.message || "Payment failed");
        return;
      }
      const status = result.paymentIntent?.status;
      if (status !== "succeeded") {
        onError("Payment has not completed.");
        return;
      }
      await onConfirm();
    } finally {
      onProcessing(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="rounded-lg border border-gray-200 p-3">
        <PaymentElement options={{ layout: "tabs" }} />
      </div>
      <button type="submit" disabled={processing || !stripe || !elements} className="w-full h-11 rounded bg-blue-600 text-white font-medium transition-all duration-200 disabled:opacity-60">
        {processing ? "Processing..." : "Confirm Purchase"}
      </button>
    </form>
  );
}

export default function EventDetailPage() {
  const params = useParams<{ slug: string }>();
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ guestName: "", guestEmail: "", guestPhone: "", quantity: 1 });
  const [clientSecret, setClientSecret] = useState("");
  const [paymentIntentId, setPaymentIntentId] = useState("");
  const [step, setStep] = useState<"form" | "payment" | "done">("form");
  const [processing, setProcessing] = useState(false);
  const [ticketCode, setTicketCode] = useState("");
  const [calendarIcs, setCalendarIcs] = useState("");

  useEffect(() => {
    fetch(`/api/events?slug=${encodeURIComponent(params.slug)}`)
      .then(async r => (r.ok ? r.json() : Promise.reject(new Error("Event not found"))))
      .then(data => setEvent(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.slug]);

  const maxSelectable = useMemo(() => Math.max(1, Math.min(10, event?.remainingTickets || 1)), [event?.remainingTickets]);
  const total = (event?.ticketPrice || 0) * form.quantity;

  async function preparePurchase(e: React.FormEvent) {
    e.preventDefault();
    if (!event) return;
    setError("");
    const res = await fetch(`/api/events/${event.id}/purchase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phase: "prepare",
        guestName: form.guestName,
        guestEmail: form.guestEmail,
        guestPhone: form.guestPhone,
        quantity: form.quantity,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.clientSecret) {
      setError(data.error || "Unable to start checkout.");
      return;
    }
    setClientSecret(String(data.clientSecret));
    setPaymentIntentId(String(data.paymentIntentId));
    setStep("payment");
  }

  async function finalizePurchase() {
    if (!event || !paymentIntentId) return;
    const res = await fetch(`/api/events/${event.id}/purchase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phase: "finalize",
        paymentIntentId,
        guestName: form.guestName,
        guestEmail: form.guestEmail,
        guestPhone: form.guestPhone,
        quantity: form.quantity,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ticket?.code) {
      setError(data.error || "Unable to finalize ticket.");
      return;
    }
    setTicketCode(data.ticket.code);
    setCalendarIcs(String(data.calendarIcs || ""));
    setStep("done");
    const refreshed = await fetch(`/api/events?slug=${encodeURIComponent(params.slug)}`).then(r => r.json());
    setEvent(refreshed);
  }

  function downloadCalendar() {
    if (!event || !ticketCode || !calendarIcs) return;
    const blob = new Blob([calendarIcs], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event.slug}-${ticketCode}.ics`;
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
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold">{event.name}</h1>
              <p className="text-sm text-gray-500 mt-1">{event.date} · {formatTime12(event.startTime)}{event.endTime ? ` - ${formatTime12(event.endTime)}` : ""}</p>
            </div>
            {soldOut ? (
              <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">Sold Out</span>
            ) : (
              <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">{event.remainingTickets} tickets left</span>
            )}
          </div>
          {event.description && <p className="mt-3 text-gray-700">{event.description}</p>}
          <div className="mt-4 font-semibold">Ticket Price: ${(event.ticketPrice / 100).toFixed(2)}</div>
        </div>

        {step === "done" ? (
          <div className="bg-white rounded-xl shadow p-6 space-y-3">
            <h2 className="text-xl font-bold">Purchase Confirmed</h2>
            <p className="text-sm text-gray-600">Your ticket code is <strong>{ticketCode}</strong>.</p>
            <button onClick={downloadCalendar} className="h-11 px-4 rounded bg-blue-600 text-white text-sm font-medium transition-all duration-200">Add to Calendar</button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow p-6 space-y-3">
            {soldOut ? (
              <p className="text-red-600">Sold Out</p>
            ) : step === "form" ? (
              <form onSubmit={preparePurchase} className="space-y-3">
                <input value={form.guestName} onChange={e => setForm(prev => ({ ...prev, guestName: e.target.value }))} placeholder="Full name" className="h-11 w-full border rounded px-3" required />
                <input type="email" value={form.guestEmail} onChange={e => setForm(prev => ({ ...prev, guestEmail: e.target.value }))} placeholder="Email" className="h-11 w-full border rounded px-3" required />
                <input value={form.guestPhone} onChange={e => setForm(prev => ({ ...prev, guestPhone: e.target.value }))} placeholder="Phone (optional)" className="h-11 w-full border rounded px-3" />
                <label className="block text-sm font-medium">
                  Quantity
                  <select value={form.quantity} onChange={e => setForm(prev => ({ ...prev, quantity: Math.max(1, Number(e.target.value)) }))} className="mt-1 h-11 w-full border rounded px-3">
                    {Array.from({ length: maxSelectable }).map((_, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1}</option>
                    ))}
                  </select>
                </label>
                <div className="text-sm text-gray-600">Total: ${(total / 100).toFixed(2)}</div>
                <button type="submit" className="w-full h-11 rounded bg-blue-600 text-white font-medium transition-all duration-200">Continue to Payment</button>
              </form>
            ) : (
              <>
                <div className="text-sm text-gray-600">Total: ${(total / 100).toFixed(2)}</div>
                {!stripePromise || !clientSecret ? (
                  <p className="text-sm text-red-600">Stripe is not configured.</p>
                ) : (
                  <Elements stripe={stripePromise} options={{ clientSecret }}>
                    <CheckoutForm
                      processing={processing}
                      onProcessing={setProcessing}
                      onConfirm={finalizePurchase}
                      onError={setError}
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
