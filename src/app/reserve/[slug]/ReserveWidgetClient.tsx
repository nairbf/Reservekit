"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
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

interface ExpressMenuItem {
  id: number;
  name: string;
  description: string | null;
  price?: number;
  dietaryTags: string | null;
}

interface ExpressMenuCategory {
  id: number;
  name: string;
  type?: string;
  items: ExpressMenuItem[];
}

interface ExpressConfig {
  mode: "prices" | "browse";
  payment: "precharge" | "optional" | "none";
  cutoffHours: number;
  message: string;
}

interface ExpressLine {
  key: string;
  menuItemId: number;
  itemName: string;
  quantity: number;
  specialInstructions: string;
  price: number;
  section: "starter" | "drink";
}

interface PreOrderRecord {
  id: number;
  status: string;
  specialNotes: string | null;
  subtotal: number;
  isPaid: boolean;
  items: Array<{
    id: number;
    menuItemId: number;
    quantity: number;
    specialInstructions: string | null;
    price: number;
    menuItem?: {
      id: number;
      name: string;
      category?: { type?: string | null } | null;
    };
  }>;
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

function tagList(value: string | null | undefined): string[] {
  return String(value || "")
    .split(",")
    .map(tag => tag.trim())
    .filter(Boolean);
}

function categorySection(type?: string | null): "starter" | "drink" {
  return String(type || "starter").toLowerCase() === "drink" ? "drink" : "starter";
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

function ExpressPaymentStep({
  subtotal,
  processing,
  onProcessingChange,
  onPaid,
  onError,
}: {
  subtotal: number;
  processing: boolean;
  onProcessingChange: (value: boolean) => void;
  onPaid: () => Promise<void>;
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
      if (status !== "succeeded" && status !== "requires_capture" && status !== "processing") {
        onError("Payment is still pending. Please try again.");
        return;
      }
      await onPaid();
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
        className="w-full h-11 rounded bg-emerald-600 text-white font-medium transition-all duration-200 disabled:opacity-60"
      >
        {processing ? "Processing..." : `Pay ${formatCents(subtotal)} and Submit`}
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
  const [expressInitialized, setExpressInitialized] = useState(false);
  const [expressStage, setExpressStage] = useState<"idle" | "prompt" | "editor" | "payment" | "done">("idle");
  const [expressLoading, setExpressLoading] = useState(false);
  const [expressError, setExpressError] = useState("");
  const [expressPaymentError, setExpressPaymentError] = useState("");
  const [expressConfig, setExpressConfig] = useState<ExpressConfig | null>(null);
  const [expressCategories, setExpressCategories] = useState<ExpressMenuCategory[]>([]);
  const [expressLines, setExpressLines] = useState<ExpressLine[]>([]);
  const [expressNotes, setExpressNotes] = useState("");
  const [expressPayNow, setExpressPayNow] = useState(false);
  const [expressClientSecret, setExpressClientSecret] = useState("");
  const [expressPreOrderId, setExpressPreOrderId] = useState<number | null>(null);
  const [expressSubmitted, setExpressSubmitted] = useState<PreOrderRecord | null>(null);

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

  const expressStarterCategories = useMemo(
    () => expressCategories.filter(category => categorySection(category.type) === "starter"),
    [expressCategories],
  );
  const expressDrinkCategories = useMemo(
    () => expressCategories.filter(category => categorySection(category.type) === "drink"),
    [expressCategories],
  );
  const expressSubtotal = useMemo(
    () => expressLines.reduce((sum, line) => sum + line.price * line.quantity, 0),
    [expressLines],
  );

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

  useEffect(() => {
    if (step !== "done") {
      setExpressInitialized(false);
      setExpressStage("idle");
      return;
    }
    if (!expressDiningEnabled || !confirmCode || dismissExpressPrompt || expressInitialized) return;

    let cancelled = false;

    async function loadExpress() {
      setExpressLoading(true);
      setExpressError("");
      try {
        const [lookupRes, menuRes] = await Promise.all([
          fetch(`/api/preorder?code=${encodeURIComponent(confirmCode)}&phone=${encodeURIComponent(phone)}`),
          fetch("/api/menu/categories?public=true"),
        ]);

        if (!lookupRes.ok || !menuRes.ok) {
          if (!cancelled) setExpressStage("idle");
          return;
        }

        const lookup = await lookupRes.json();
        const categories = await menuRes.json();

        const config = lookup?.config as ExpressConfig | undefined;
        const cutoffOpen = Boolean(lookup?.cutoffOpen);
        const existing = (lookup?.preOrder || null) as PreOrderRecord | null;

        const categoryList = Array.isArray(categories)
          ? (categories as ExpressMenuCategory[])
              .filter(category => ["starter", "drink"].includes(String(category.type || "starter").toLowerCase()))
              .filter(category => Array.isArray(category.items) && category.items.length > 0)
          : [];

        if (!config || !cutoffOpen || categoryList.length === 0) {
          if (!cancelled) setExpressStage("idle");
          return;
        }

        if (cancelled) return;

        setExpressConfig(config);
        setExpressCategories(categoryList);
        setExpressPayNow(config.payment === "precharge");

        if (existing && existing.status !== "cancelled") {
          const sectionMap = new Map<number, "starter" | "drink">();
          for (const category of categoryList) {
            for (const item of category.items) {
              sectionMap.set(item.id, categorySection(category.type));
            }
          }
          const mapped = (existing.items || []).map((item, idx) => ({
            key: `existing-${item.id}-${idx}`,
            menuItemId: item.menuItemId,
            itemName: item.menuItem?.name || `Item ${item.menuItemId}`,
            quantity: Math.max(1, Number(item.quantity || 1)),
            specialInstructions: item.specialInstructions || "",
            price: Number(item.price || 0),
            section: sectionMap.get(item.menuItemId) || "starter",
          }));
          setExpressLines(mapped);
          setExpressNotes(existing.specialNotes || "");
          setExpressSubmitted(existing);
          setExpressPreOrderId(existing.id);
          setExpressStage("done");
        } else {
          setExpressStage("prompt");
        }

        setExpressInitialized(true);
      } catch {
        if (!cancelled) {
          setExpressStage("idle");
        }
      } finally {
        if (!cancelled) setExpressLoading(false);
      }
    }

    loadExpress();

    return () => {
      cancelled = true;
    };
  }, [confirmCode, dismissExpressPrompt, expressDiningEnabled, expressInitialized, phone, step]);

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

  function addExpressItem(item: ExpressMenuItem, section: "starter" | "drink") {
    setExpressLines(prev => {
      const existingIdx = prev.findIndex(
        line => line.menuItemId === item.id && line.specialInstructions.trim() === "",
      );
      if (existingIdx >= 0) {
        return prev.map((line, idx) => (idx === existingIdx ? { ...line, quantity: line.quantity + 1 } : line));
      }
      return [
        ...prev,
        {
          key: `${item.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          menuItemId: item.id,
          itemName: item.name,
          quantity: 1,
          specialInstructions: "",
          price: Number(item.price || 0),
          section,
        },
      ];
    });
  }

  function updateExpressLine(key: string, patch: Partial<ExpressLine>) {
    setExpressLines(prev => prev.map(line => (line.key === key ? { ...line, ...patch } : line)));
  }

  function removeExpressLine(key: string) {
    setExpressLines(prev => prev.filter(line => line.key !== key));
  }

  async function submitExpressPreOrder() {
    if (!confirmCode || !expressConfig) return;
    if (expressLines.length === 0) {
      setExpressError("Choose at least one item before submitting.");
      return;
    }

    const payNow = expressConfig.payment === "precharge"
      ? true
      : expressConfig.payment === "optional"
        ? expressPayNow
        : false;

    setExpressLoading(true);
    setExpressError("");
    setExpressPaymentError("");
    try {
      const res = await fetch("/api/preorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationCode: confirmCode,
          phone,
          specialNotes: expressNotes || null,
          payNow,
          items: expressLines.map(line => ({
            menuItemId: line.menuItemId,
            quantity: Math.max(1, Math.trunc(line.quantity)),
            specialInstructions: line.specialInstructions || undefined,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setExpressError(data.error || "Could not save pre-order.");
        return;
      }

      const preOrder = (data.preOrder || null) as PreOrderRecord | null;
      setExpressSubmitted(preOrder);
      setExpressPreOrderId(preOrder?.id || null);

      if (data.clientSecret) {
        setExpressClientSecret(String(data.clientSecret));
        setExpressStage("payment");
        return;
      }

      setExpressStage("done");
    } finally {
      setExpressLoading(false);
    }
  }

  async function finalizeExpressPayment() {
    if (!expressPreOrderId || !confirmCode) {
      setExpressPaymentError("Could not finalize payment. Please try again.");
      return;
    }

    const res = await fetch(`/api/preorder/${expressPreOrderId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "mark_paid",
        code: confirmCode,
        phone,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setExpressPaymentError(data.error || "Could not finalize payment.");
      return;
    }

    setExpressSubmitted((data.preOrder || data) as PreOrderRecord);
    setExpressStage("done");
  }

  function resetExpressState() {
    setDismissExpressPrompt(false);
    setExpressInitialized(false);
    setExpressStage("idle");
    setExpressLoading(false);
    setExpressError("");
    setExpressPaymentError("");
    setExpressConfig(null);
    setExpressCategories([]);
    setExpressLines([]);
    setExpressNotes("");
    setExpressPayNow(false);
    setExpressClientSecret("");
    setExpressPreOrderId(null);
    setExpressSubmitted(null);
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
    const canShowExpress = expressDiningEnabled && !dismissExpressPrompt && expressStage !== "idle";

    return (
      <div className={wrapperClass}>
        <div className={embedded ? "space-y-4" : "max-w-3xl mx-auto p-6 space-y-4 transition-all duration-200"}>
          <div className={embedded ? "text-center" : "text-center"}>
            <div className="text-5xl mb-4 animate-bounce">OK</div>
            <h2 className="text-2xl font-bold mb-2">Request Received!</h2>
            <p className={`${textMutedClass} mb-1`}>{date} at {fmt(selectedTime)}</p>
            <p className={`${textMutedClass} mb-4`}>Party of {partySize}</p>
            {depositMeta.required && (
              <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 text-left">
                {depositMeta.message || depositMessage} {depositMeta.amount > 0 ? `Deposit amount: ${formatCents(depositMeta.amount)}.` : ""}
              </div>
            )}
            <p className={`text-sm ${textMutedClass} mb-2`}>Reference: <strong>{confirmCode}</strong></p>
            <p className={`text-sm ${textMutedClass}`}>{reserveConfirmationMessage}</p>
          </div>

          {expressLoading && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Loading starters & drinks...
            </div>
          )}

          {canShowExpress && expressStage === "prompt" && (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-900 p-4 text-left">
              <p className="font-semibold text-sm">🍽 Would you like to pre-order starters & drinks?</p>
              <p className="text-xs mt-1">
                {expressConfig?.message || expressDiningMessage}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setExpressStage("editor")}
                  className="h-10 px-3 rounded bg-emerald-600 text-white text-xs font-medium"
                >
                  Yes, browse the menu
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDismissExpressPrompt(true);
                    setExpressStage("idle");
                  }}
                  className="h-10 px-3 rounded border border-emerald-300 text-emerald-800 text-xs font-medium"
                >
                  No thanks, skip
                </button>
              </div>
            </div>
          )}

          {canShowExpress && expressStage === "editor" && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 space-y-4">
              <div>
                <h3 className="text-lg font-bold">Starters & Drinks Pre-Order</h3>
                <p className="text-sm text-gray-500">Optional and skippable. Submit what you want ready on arrival.</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">🍽</span>
                  <h4 className="font-semibold">Starters</h4>
                </div>
                {expressStarterCategories.length === 0 ? (
                  <p className="text-sm text-gray-500">No starter items available.</p>
                ) : (
                  expressStarterCategories.map(category => (
                    <div key={`starter-${category.id}`} className="rounded-lg border border-gray-200 p-3">
                      <p className="text-sm font-semibold mb-2">{category.name}</p>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {category.items.map(item => (
                          <div key={item.id} className="rounded-lg border border-gray-100 p-2">
                            <p className="text-sm font-medium">{item.name}</p>
                            {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                            {tagList(item.dietaryTags).length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {tagList(item.dietaryTags).map(tag => (
                                  <span key={`${item.id}-${tag}`} className="text-[10px] rounded-full bg-gray-100 text-gray-700 px-2 py-0.5">{tag}</span>
                                ))}
                              </div>
                            )}
                            {expressConfig?.mode === "prices" && typeof item.price === "number" && (
                              <p className="text-xs font-semibold mt-1">{formatCents(item.price)}</p>
                            )}
                            <button
                              type="button"
                              onClick={() => addExpressItem(item, "starter")}
                              className="mt-2 h-9 px-3 rounded bg-emerald-600 text-white text-xs font-medium"
                            >
                              + Add
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">🥂</span>
                  <h4 className="font-semibold">Drinks</h4>
                </div>
                {expressDrinkCategories.length === 0 ? (
                  <p className="text-sm text-gray-500">No drinks available.</p>
                ) : (
                  expressDrinkCategories.map(category => (
                    <div key={`drink-${category.id}`} className="rounded-lg border border-gray-200 p-3">
                      <p className="text-sm font-semibold mb-2">{category.name}</p>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {category.items.map(item => (
                          <div key={item.id} className="rounded-lg border border-gray-100 p-2">
                            <p className="text-sm font-medium">{item.name}</p>
                            {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                            {tagList(item.dietaryTags).length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {tagList(item.dietaryTags).map(tag => (
                                  <span key={`${item.id}-${tag}`} className="text-[10px] rounded-full bg-gray-100 text-gray-700 px-2 py-0.5">{tag}</span>
                                ))}
                              </div>
                            )}
                            {expressConfig?.mode === "prices" && typeof item.price === "number" && (
                              <p className="text-xs font-semibold mt-1">{formatCents(item.price)}</p>
                            )}
                            <button
                              type="button"
                              onClick={() => addExpressItem(item, "drink")}
                              className="mt-2 h-9 px-3 rounded bg-emerald-600 text-white text-xs font-medium"
                            >
                              + Add
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="rounded-lg border border-gray-200 p-3">
                <h4 className="font-semibold text-sm mb-2">Order Summary</h4>
                {expressLines.length === 0 ? (
                  <p className="text-sm text-gray-500">No items selected yet.</p>
                ) : (
                  <div className="space-y-2">
                    {expressLines.map(line => (
                      <div key={line.key} className="rounded border border-gray-100 p-2">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span>{line.quantity}x {line.itemName}</span>
                          <button type="button" className="text-red-600 text-xs" onClick={() => removeExpressLine(line.key)}>Remove</button>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateExpressLine(line.key, { quantity: Math.max(1, line.quantity - 1) })}
                            className="h-8 w-8 rounded border border-gray-200 text-sm"
                          >
                            -
                          </button>
                          <span className="text-sm min-w-[18px] text-center">{line.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateExpressLine(line.key, { quantity: line.quantity + 1 })}
                            className="h-8 w-8 rounded border border-gray-200 text-sm"
                          >
                            +
                          </button>
                          <input
                            value={line.specialInstructions}
                            onChange={e => updateExpressLine(line.key, { specialInstructions: e.target.value })}
                            placeholder="Instructions (optional)"
                            className="h-8 flex-1 border rounded px-2 text-xs"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <textarea
                  value={expressNotes}
                  onChange={e => setExpressNotes(e.target.value)}
                  placeholder="Any requests for the kitchen?"
                  rows={2}
                  className="mt-3 w-full border rounded px-3 py-2 text-sm"
                />

                {expressConfig?.mode === "prices" && (
                  <p className="mt-2 text-sm font-semibold">Subtotal: {formatCents(expressSubtotal)}</p>
                )}

                {expressConfig?.payment === "optional" && (
                  <label className="mt-2 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={expressPayNow}
                      onChange={e => setExpressPayNow(e.target.checked)}
                      className="h-4 w-4"
                    />
                    Pay now {expressConfig.mode === "prices" ? `(${formatCents(expressSubtotal)})` : ""}
                  </label>
                )}

                {expressConfig?.payment === "precharge" && (
                  <div className="mt-2 rounded border border-amber-300 bg-amber-50 text-amber-900 px-2 py-1 text-xs">
                    Payment is required to submit this pre-order.
                  </div>
                )}

                {expressError && <p className="mt-2 text-sm text-red-600">{expressError}</p>}

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={submitExpressPreOrder}
                    disabled={expressLoading}
                    className="h-10 px-3 rounded bg-emerald-600 text-white text-sm font-medium disabled:opacity-60"
                  >
                    {expressLoading ? "Submitting..." : "Submit Pre-Order"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDismissExpressPrompt(true);
                      setExpressStage("idle");
                    }}
                    className="h-10 px-3 rounded border border-gray-200 text-sm"
                  >
                    Skip
                  </button>
                </div>
              </div>
            </div>
          )}

          {canShowExpress && expressStage === "payment" && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 space-y-3">
              <h3 className="text-lg font-bold">Complete Pre-Order Payment</h3>
              <p className="text-sm text-gray-500">Your starters & drinks will be sent to staff immediately after payment.</p>
              {expressPaymentError && <p className="text-sm text-red-600">{expressPaymentError}</p>}
              {!stripePromise || !expressClientSecret ? (
                <p className="text-sm text-red-600">Unable to initialize payment form.</p>
              ) : (
                <Elements stripe={stripePromise} options={{ clientSecret: expressClientSecret }}>
                  <ExpressPaymentStep
                    subtotal={expressSubtotal}
                    processing={expressLoading}
                    onProcessingChange={setExpressLoading}
                    onError={setExpressPaymentError}
                    onPaid={finalizeExpressPayment}
                  />
                </Elements>
              )}
            </div>
          )}

          {canShowExpress && expressStage === "done" && (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-900 p-4">
              <p className="font-semibold text-sm">🍽 Your starters & drinks are confirmed!</p>
              <p className="text-xs mt-1">We’ll have them ready when you arrive.</p>
              {expressSubmitted && (
                <div className="mt-2 text-xs">
                  <div>Subtotal: {formatCents(expressSubmitted.subtotal)}</div>
                  <div>Paid: {expressSubmitted.isPaid ? "Yes" : "No"}</div>
                </div>
              )}
              <a
                href={`/preorder/${encodeURIComponent(confirmCode)}`}
                className="mt-3 inline-flex h-9 items-center px-3 rounded border border-emerald-300 text-xs font-medium"
              >
                View/Edit Full Pre-Order
              </a>
            </div>
          )}

          <div className="text-center">
            <button
              onClick={() => {
                setStep("select");
                setSelectedTime("");
                setPaymentClientSecret("");
                setPaymentError("");
                setPaymentProcessing(false);
                resetExpressState();
              }}
              className="mt-2 h-11 px-4 rounded-lg border text-sm transition-all duration-200"
              style={{ borderColor: primary, color: primary }}
            >
              Make another reservation
            </button>
          </div>
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

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
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
