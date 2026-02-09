"use client";
import { useState, useEffect, useCallback } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

interface Slot { time: string; available: boolean }
interface AvailabilityDeposit {
  required: boolean;
  amount: number;
  minParty: number;
  message: string;
  type?: "hold" | "deposit";
  source?: string;
  label?: string | null;
}

interface LoyaltyLookupResponse {
  enabled: boolean;
  known: boolean;
  optedIn: boolean;
}

interface ReserveWidgetClientProps {
  restaurantName: string;
  embedded?: boolean;
  theme?: "light" | "dark";
  accent?: string;
  reserveHeading?: string;
  reserveSubheading?: string;
  reserveConfirmationMessage?: string;
  reserveRequestDisclaimer?: string;
  reserveRequestPlaceholder?: string;
  reserveRequestSamples?: string[];
  loyaltyOptInEnabled?: boolean;
  loyaltyProgramName?: string;
  loyaltyOptInMessage?: string;
  loyaltyOptInLabel?: string;
  depositsEnabled?: boolean;
  depositType?: "hold" | "deposit";
  depositAmount?: number;
  depositMinParty?: number;
  depositMessage?: string;
  expressDiningEnabled?: boolean;
  expressDiningMessage?: string;
}

function fmt(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function getAccent(accent?: string): string {
  if (!accent) return "#2563eb";
  return /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/.test(accent) ? accent : "#2563eb";
}

function normalizePhone(value: string): string | null {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

function formatCents(cents: number): string {
  return `$${(Math.max(0, Math.trunc(cents)) / 100).toFixed(2)}`;
}

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

function PaymentCardStep({
  amountCents,
  paymentType,
  processing,
  onProcessingChange,
  onPaid,
  onError,
}: {
  amountCents: number;
  paymentType: "hold" | "deposit";
  processing: boolean;
  onProcessingChange: (next: boolean) => void;
  onPaid: () => void;
  onError: (message: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();

  async function confirmCard(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    onProcessingChange(true);
    onError("");
    try {
      const result = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
      });
      if (result.error) {
        onError(result.error.message || "Payment confirmation failed.");
        return;
      }
      const status = result.paymentIntent?.status;
      if (status === "succeeded" || status === "requires_capture" || status === "processing") {
        onPaid();
      } else {
        onError("Payment is still pending. Please try again.");
      }
    } finally {
      onProcessingChange(false);
    }
  }

  return (
    <form onSubmit={confirmCard} className="space-y-3">
      <div className="rounded-lg border border-gray-200 p-3">
        <PaymentElement options={{ layout: "tabs" }} />
      </div>
      <button
        type="submit"
        disabled={processing || !stripe || !elements}
        className="w-full h-11 rounded text-white font-medium transition-all duration-200 disabled:opacity-60"
        style={{ backgroundColor: "#2563eb" }}
      >
        {processing
          ? "Processing..."
          : paymentType === "hold"
            ? `Place Card Hold (${formatCents(amountCents)})`
            : `Pay Deposit (${formatCents(amountCents)})`}
      </button>
    </form>
  );
}

export default function ReserveWidgetClient({
  restaurantName,
  embedded = false,
  theme = "light",
  accent,
  reserveHeading = "Reserve a Table",
  reserveSubheading = "Choose your date, time, and party size.",
  reserveConfirmationMessage = "We'll contact you shortly to confirm.",
  reserveRequestDisclaimer = "Your request will be reviewed and confirmed shortly.",
  reserveRequestPlaceholder = "e.g., Birthday dinner, window seat, stroller space",
  reserveRequestSamples = ["Birthday celebration", "Window seat", "High chair"],
  loyaltyOptInEnabled = false,
  loyaltyProgramName = "Loyalty Program",
  loyaltyOptInMessage = "Join our loyalty list for offers and updates by SMS.",
  loyaltyOptInLabel = "Yes, opt me in for loyalty messages.",
  depositsEnabled = false,
  depositType = "hold",
  depositAmount = 0,
  depositMinParty = 2,
  depositMessage = "A refundable deposit may be required to hold your table.",
  expressDiningEnabled = false,
  expressDiningMessage = "Pre-select your meal and skip the wait! Your order will be ready when you arrive.",
}: ReserveWidgetClientProps) {
  const [step, setStep] = useState<"select" | "form" | "payment" | "done">("select");
  const [date, setDate] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedTime, setSelectedTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [error, setError] = useState("");
  const [depositMeta, setDepositMeta] = useState<{ required: boolean; amount: number; message: string | null }>({ required: false, amount: 0, message: null });
  const [paymentClientSecret, setPaymentClientSecret] = useState("");
  const [paymentType, setPaymentType] = useState<"hold" | "deposit">(depositType);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [loyaltyChecking, setLoyaltyChecking] = useState(false);
  const [loyaltyKnown, setLoyaltyKnown] = useState(false);
  const [loyaltyKnownOptIn, setLoyaltyKnownOptIn] = useState(false);
  const [loyaltyOptInChoice, setLoyaltyOptInChoice] = useState(false);
  const [availabilityDeposit, setAvailabilityDeposit] = useState<AvailabilityDeposit>({
    required: depositsEnabled && depositAmount > 0 && partySize >= Math.max(1, depositMinParty),
    amount: depositAmount,
    minParty: depositMinParty,
    message: depositMessage,
    type: depositType,
    source: "global",
    label: null,
  });
  const [dismissExpressPrompt, setDismissExpressPrompt] = useState(false);

  const isDark = theme === "dark";
  const primary = getAccent(accent);

  const wrapperClass = embedded
    ? `w-full ${isDark ? "text-zinc-100" : "text-gray-900"}`
    : "max-w-md mx-auto p-6 transition-all duration-200";

  const textMutedClass = isDark ? "text-zinc-300" : "text-gray-500";
  const textSoftClass = isDark ? "text-zinc-400" : "text-gray-400";
  const borderClass = isDark ? "border-zinc-700" : "border-gray-200";

  const inputClass = isDark
    ? "h-11 w-full border border-zinc-700 rounded px-3 py-2 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500"
    : "h-11 w-full border rounded px-3 py-2";

  const textareaClass = isDark
    ? "w-full border border-zinc-700 rounded px-3 py-2 mb-4 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500"
    : "w-full border rounded px-3 py-2 mb-4";

  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setDate(d.toISOString().split("T")[0]);
  }, []);

  const loadSlots = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    setSelectedTime("");
    const res = await fetch(`/api/availability?date=${date}&partySize=${partySize}`);
    const payload = await res.json();
    setSlots(payload.slots || []);
    if (payload.deposit) {
      setAvailabilityDeposit({
        required: Boolean(payload.deposit.required),
        amount: Number(payload.deposit.amount || 0),
        minParty: Number(payload.deposit.minParty || Math.max(1, depositMinParty)),
        message: String(payload.deposit.message || depositMessage),
        type: payload.deposit.type === "deposit" ? "deposit" : "hold",
        source: payload.deposit.source || "global",
        label: payload.deposit.label || null,
      });
    } else {
      setAvailabilityDeposit({
        required: depositsEnabled && depositAmount > 0 && partySize >= Math.max(1, depositMinParty),
        amount: depositAmount,
        minParty: depositMinParty,
        message: depositMessage,
        type: depositType,
        source: "global",
        label: null,
      });
    }
    setLoading(false);
  }, [date, partySize, depositAmount, depositMessage, depositMinParty, depositsEnabled, depositType]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  useEffect(() => {
    if (!loyaltyOptInEnabled) {
      setLoyaltyChecking(false);
      setLoyaltyKnown(false);
      setLoyaltyKnownOptIn(false);
      return;
    }

    const normalized = normalizePhone(phone);
    if (!normalized) {
      setLoyaltyChecking(false);
      setLoyaltyKnown(false);
      setLoyaltyKnownOptIn(false);
      return;
    }

    setLoyaltyKnown(false);
    setLoyaltyKnownOptIn(false);

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoyaltyChecking(true);
      try {
        const res = await fetch(`/api/loyalty/consent?phone=${encodeURIComponent(phone)}`);
        if (!res.ok) {
          if (!cancelled) {
            setLoyaltyKnown(false);
            setLoyaltyKnownOptIn(false);
          }
          return;
        }
        const data = (await res.json()) as LoyaltyLookupResponse;
        if (cancelled) return;
        if (!data.enabled) {
          setLoyaltyKnown(false);
          setLoyaltyKnownOptIn(false);
          return;
        }
        setLoyaltyKnown(Boolean(data.known));
        setLoyaltyKnownOptIn(Boolean(data.optedIn));
      } finally {
        if (!cancelled) setLoyaltyChecking(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [phone, loyaltyOptInEnabled]);

  const depositApplies = availabilityDeposit.required;
  const canCaptureLoyalty = loyaltyOptInEnabled && Boolean(normalizePhone(phone)) && !loyaltyKnown && !loyaltyChecking;

  function applySample(sample: string) {
    const trimmed = sample.trim();
    if (!trimmed) return;
    setNotes(prev => {
      if (!prev.trim()) return trimmed;
      if (prev.toLowerCase().includes(trimmed.toLowerCase())) return prev;
      return `${prev.replace(/\s+$/, "")}; ${trimmed}`;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPaymentError("");
    setPaymentClientSecret("");
    setPaymentProcessing(false);

    let liveDeposit = availabilityDeposit;
    try {
      const depositConfigRes = await fetch(`/api/payments/deposit-config?date=${encodeURIComponent(date)}&partySize=${partySize}`);
      if (depositConfigRes.ok) {
        const cfg = await depositConfigRes.json();
        liveDeposit = {
          required: Boolean(cfg.required),
          amount: Number(cfg.amount || 0),
          minParty: Number(cfg.minPartySize || Math.max(1, depositMinParty)),
          message: String(cfg.message || depositMessage),
          type: cfg.type === "deposit" ? "deposit" : "hold",
          source: cfg.source || "global",
          label: cfg.label || null,
        };
      }
    } catch {
      // Keep the previously loaded deposit config.
    }

    if (liveDeposit.required && !stripePromise) {
      setError("Card checkout is not configured right now. Please call the restaurant to book this request.");
      return;
    }

    const res = await fetch("/api/reservations/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guestName: name,
        guestPhone: phone,
        guestEmail: email || null,
        partySize,
        date,
        time: selectedTime,
        specialRequests: notes || null,
        loyaltyOptIn: canCaptureLoyalty ? loyaltyOptInChoice : undefined,
      }),
    });
    if (res.ok) {
      const d = await res.json();
      setConfirmCode(d.code);
      const required = Boolean(d.depositRequired ?? liveDeposit.required);
      const amount = Number(d.depositAmount ?? liveDeposit.amount ?? 0);
      const message = String(d.depositMessage || liveDeposit.message || "");
      setDepositMeta({ required, amount, message });

      if (required && d.id) {
        const intentRes = await fetch("/api/payments/create-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reservationId: d.id,
            amount,
            type: liveDeposit.type || "hold",
          }),
        });
        const intentData = await intentRes.json();
        if (!intentRes.ok || !intentData.clientSecret) {
          setError(intentData.error || "Unable to start deposit checkout. Please try again.");
          return;
        }
        setPaymentClientSecret(String(intentData.clientSecret));
        setPaymentType((liveDeposit.type === "deposit" ? "deposit" : "hold"));
        setStep("payment");
        return;
      }

      setStep("done");
    } else {
      setError((await res.json()).error || "Something went wrong");
    }
  }

  if (step === "done") {
    return (
      <div className={wrapperClass}>
        <div className={embedded ? "text-center" : "max-w-md mx-auto p-6 text-center transition-all duration-200"}>
          <div className="text-5xl mb-4 animate-bounce">OK</div>
          <h2 className="text-2xl font-bold mb-2">Request Received!</h2>
          <p className={`${textMutedClass} mb-1`}>{date} at {fmt(selectedTime)}</p>
          <p className={`${textMutedClass} mb-4`}>Party of {partySize}</p>
          {depositMeta.required && (
            <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {depositMeta.message || depositMessage} {depositMeta.amount > 0 ? `Deposit amount: ${formatCents(depositMeta.amount)}.` : ""}
            </div>
          )}
          <p className={`text-sm ${textMutedClass} mb-2`}>Reference: <strong>{confirmCode}</strong></p>
          <p className={`text-sm ${textMutedClass}`}>{reserveConfirmationMessage}</p>
          {expressDiningEnabled && confirmCode && !dismissExpressPrompt && (
            <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-900 p-3 text-left">
              <p className="font-semibold text-sm">🍽 Want your food ready when you arrive?</p>
              <p className="text-xs mt-1">{expressDiningMessage}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={`/preorder/${encodeURIComponent(confirmCode)}`}
                  className="h-10 px-3 rounded bg-emerald-600 text-white text-xs font-medium inline-flex items-center"
                >
                  Browse Menu & Pre-Order
                </a>
                <button
                  type="button"
                  onClick={() => setDismissExpressPrompt(true)}
                  className="h-10 px-3 rounded border border-emerald-300 text-emerald-800 text-xs font-medium"
                >
                  Maybe later
                </button>
              </div>
            </div>
          )}
          <button
            onClick={() => {
              setStep("select");
              setSelectedTime("");
              setPaymentClientSecret("");
              setPaymentError("");
              setPaymentProcessing(false);
              setDismissExpressPrompt(false);
            }}
            className="mt-6 h-11 px-4 rounded-lg border text-sm transition-all duration-200"
            style={{ borderColor: primary, color: primary }}
          >
            Make another reservation
          </button>
        </div>
      </div>
    );
  }

  if (step === "payment") {
    return (
      <div className={wrapperClass}>
        <div className={embedded ? "space-y-4" : "max-w-md mx-auto p-6 space-y-4 transition-all duration-200"}>
          <div>
            <h2 className="text-xl font-bold mb-1">Confirm Card</h2>
            <p className={`text-sm ${textMutedClass}`}>
              {paymentType === "hold"
                ? `A card hold of ${formatCents(depositMeta.amount)} is required and released after your visit.`
                : `A deposit of ${formatCents(depositMeta.amount)} is required to confirm your reservation.`}
            </p>
          </div>
          {depositMeta.message && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {depositMeta.message}
            </div>
          )}
          {paymentError && <p className="text-sm text-red-600">{paymentError}</p>}
          {!stripePromise || !paymentClientSecret ? (
            <p className="text-sm text-red-600">Unable to initialize secure payment fields.</p>
          ) : (
            <Elements stripe={stripePromise} options={{ clientSecret: paymentClientSecret }}>
              <PaymentCardStep
                amountCents={depositMeta.amount}
                paymentType={paymentType}
                processing={paymentProcessing}
                onProcessingChange={setPaymentProcessing}
                onError={setPaymentError}
                onPaid={() => setStep("done")}
              />
            </Elements>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={wrapperClass} style={embedded ? { background: "transparent" } : undefined}>
      {!embedded && (
        <div className="text-center mb-4">
          <div className={`text-sm ${textMutedClass}`}>{restaurantName}</div>
          <h1 className="text-xl font-bold">{reserveHeading}</h1>
          <p className={`text-xs mt-1 ${textSoftClass}`}>{reserveSubheading}</p>
        </div>
      )}

      <div className="flex gap-3 mb-4">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Guests</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPartySize(Math.max(1, partySize - 1))}
              className={`w-11 h-11 border rounded transition-all duration-200 ${borderClass} ${isDark ? "bg-zinc-900" : ""}`}
            >
              -
            </button>
            <span className="w-6 text-center font-bold">{partySize}</span>
            <button
              type="button"
              onClick={() => setPartySize(Math.min(8, partySize + 1))}
              className={`w-11 h-11 border rounded transition-all duration-200 ${borderClass} ${isDark ? "bg-zinc-900" : ""}`}
            >
              +
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className={`flex items-center gap-3 text-sm mb-4 ${textSoftClass}`}>
          <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
          Loading times...
        </div>
      ) : slots.length === 0 ? (
        <p className={`text-sm mb-4 ${textMutedClass}`}>No availability for this date.</p>
      ) : (
        <div className="grid grid-cols-2 min-[360px]:grid-cols-3 gap-2 mb-4">
          {slots.map(s => {
            const isSelected = s.time === selectedTime;
            return (
              <button
                key={s.time}
                disabled={!s.available}
                onClick={() => { setSelectedTime(s.time); setStep("form"); }}
                className={`h-11 rounded text-sm font-medium transition-all duration-200 ${isSelected ? "text-white" : s.available ? `${isDark ? "bg-zinc-900 border border-zinc-700 hover:bg-zinc-800" : "bg-white border hover:bg-blue-50"}` : "bg-gray-100 text-gray-300 cursor-not-allowed"}`}
                style={isSelected ? { backgroundColor: primary } : undefined}
              >
                {fmt(s.time)}
              </button>
            );
          })}
        </div>
      )}

      {step === "form" && selectedTime && (
        <form onSubmit={submit} className={`border-t pt-4 mt-4 transition-all duration-200 ${borderClass}`}>
          <p className="text-sm font-medium mb-3">{fmt(selectedTime)} · Party of {partySize} · {date}</p>
          {depositApplies && (
            <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {availabilityDeposit.message || depositMessage}
              {availabilityDeposit.amount > 0 ? ` Deposit amount: ${formatCents(availabilityDeposit.amount)}.` : ""}
            </div>
          )}
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          <input placeholder="Your name *" value={name} onChange={e => setName(e.target.value)} className={`${inputClass} mb-3`} required />
          <input placeholder="Phone number *" type="tel" value={phone} onChange={e => setPhone(e.target.value)} className={`${inputClass} mb-3`} required />
          <input placeholder="Email (optional)" type="email" value={email} onChange={e => setEmail(e.target.value)} className={`${inputClass} mb-3`} />
          {loyaltyOptInEnabled && (
            <div className={`mb-3 rounded-lg border px-3 py-2 ${isDark ? "border-zinc-700 bg-zinc-900/60" : "border-emerald-200 bg-emerald-50"}`}>
              <p className={`text-xs font-semibold ${isDark ? "text-zinc-100" : "text-emerald-900"}`}>{loyaltyProgramName}</p>
              <p className={`text-xs mt-1 ${isDark ? "text-zinc-300" : "text-emerald-800"}`}>{loyaltyOptInMessage}</p>
              {loyaltyChecking && (
                <div className={`mt-2 text-xs flex items-center gap-2 ${textSoftClass}`}>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Checking phone preference...
                </div>
              )}
              {!loyaltyChecking && !normalizePhone(phone) && (
                <p className={`text-xs mt-2 ${textSoftClass}`}>Enter a valid phone number to show loyalty preference.</p>
              )}
              {!loyaltyChecking && loyaltyKnown && (
                <p className={`text-xs mt-2 ${isDark ? "text-zinc-300" : "text-emerald-900"}`}>
                  {loyaltyKnownOptIn ? "This number is already opted in." : "Preference already saved for this number."}
                </p>
              )}
              {!loyaltyChecking && canCaptureLoyalty && (
                <label className={`mt-2 flex items-start gap-2 text-xs ${isDark ? "text-zinc-200" : "text-emerald-900"}`}>
                  <input
                    type="checkbox"
                    checked={loyaltyOptInChoice}
                    onChange={e => setLoyaltyOptInChoice(e.target.checked)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>{loyaltyOptInLabel}</span>
                </label>
              )}
            </div>
          )}
          <textarea placeholder={reserveRequestPlaceholder} value={notes} onChange={e => setNotes(e.target.value)} className={textareaClass} rows={2} />
          {reserveRequestSamples.length > 0 && (
            <div className="mb-3">
              <p className={`text-xs mb-2 ${textSoftClass}`}>Quick request samples:</p>
              <div className="flex flex-wrap gap-2">
                {reserveRequestSamples.map(sample => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => applySample(sample)}
                    className={`px-2 py-1 text-xs rounded-full border transition-all duration-200 ${isDark ? "border-zinc-700 bg-zinc-900 text-zinc-200" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button type="submit" className="w-full h-11 text-white rounded font-medium transition-all duration-200" style={{ backgroundColor: primary }}>Request Reservation</button>
          <p className={`text-xs mt-2 text-center ${textSoftClass}`}>{reserveRequestDisclaimer}</p>
        </form>
      )}
    </div>
  );
}
