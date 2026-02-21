"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { DateTimePicker } from "./components/DateTimePicker";
import { GuestDetails } from "./components/GuestDetails";
import { Confirmation } from "./components/Confirmation";
import { DepositPayment } from "./components/DepositPayment";

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

type ExpressSection = "starter" | "main" | "side" | "dessert" | "drink" | "other";

interface ExpressCategoryGroup {
  section: ExpressSection;
  title: string;
  icon: string;
  categories: ExpressMenuCategory[];
}

interface ExpressLine {
  key: string;
  menuItemId: number;
  itemName: string;
  quantity: number;
  specialInstructions: string;
  price: number;
  section: ExpressSection;
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

const EXPRESS_SECTION_ORDER: ExpressSection[] = ["starter", "main", "side", "dessert", "drink", "other"];
const EXPRESS_SECTION_META: Record<ExpressSection, { title: string; icon: string }> = {
  starter: { title: "Starters", icon: "🍽" },
  main: { title: "Mains", icon: "🥩" },
  side: { title: "Sides", icon: "🥗" },
  dessert: { title: "Desserts", icon: "🍰" },
  drink: { title: "Drinks", icon: "🥂" },
  other: { title: "Other", icon: "📋" },
};

function categorySection(type?: string | null): ExpressSection {
  const normalized = String(type || "").trim().toLowerCase();
  if (normalized === "starter" || normalized === "main" || normalized === "side" || normalized === "dessert" || normalized === "drink" || normalized === "other") {
    return normalized;
  }
  return "other";
}

const defaultStripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

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
  const [stripePublishableKey, setStripePublishableKey] = useState(defaultStripePublishableKey);

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

  const expressCategoryGroups = useMemo<ExpressCategoryGroup[]>(
    () => EXPRESS_SECTION_ORDER
      .map(section => ({
        section,
        title: EXPRESS_SECTION_META[section].title,
        icon: EXPRESS_SECTION_META[section].icon,
        categories: expressCategories.filter(category => categorySection(category.type) === section),
      }))
      .filter(group => group.categories.length > 0),
    [expressCategories],
  );
  const expressSubtotal = useMemo(
    () => expressLines.reduce((sum, line) => sum + line.price * line.quantity, 0),
    [expressLines],
  );
  const stripePromise = useMemo(
    () => (stripePublishableKey ? loadStripe(stripePublishableKey) : null),
    [stripePublishableKey],
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
          const sectionMap = new Map<number, ExpressSection>();
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
            section: sectionMap.get(item.menuItemId) || "other",
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

  function addExpressItem(item: ExpressMenuItem, section: ExpressSection) {
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
    let effectiveStripePromise = stripePromise;
    try {
      const depositConfigRes = await fetch(`/api/payments/deposit-config?date=${encodeURIComponent(date)}&partySize=${partySize}`);
      if (depositConfigRes.ok) {
        const cfg = await depositConfigRes.json();
        const nextPublishable = String(cfg.stripePublishableKey || "").trim();
        if (nextPublishable && nextPublishable !== stripePublishableKey) {
          setStripePublishableKey(nextPublishable);
          effectiveStripePromise = loadStripe(nextPublishable);
        }
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

    if (liveDeposit.required && !effectiveStripePromise) {
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
      <Confirmation
        wrapperClass={wrapperClass}
        embedded={embedded}
        textMutedClass={textMutedClass}
        textSoftClass={textSoftClass}
        date={date}
        selectedTime={selectedTime}
        partySize={partySize}
        fmt={fmt}
        depositMeta={depositMeta}
        depositMessage={depositMessage}
        formatCents={formatCents}
        confirmCode={confirmCode}
        reserveConfirmationMessage={reserveConfirmationMessage}
        expressDiningEnabled={expressDiningEnabled}
        dismissExpressPrompt={dismissExpressPrompt}
        expressStage={expressStage}
        expressLoading={expressLoading}
        expressConfig={expressConfig}
        expressDiningMessage={expressDiningMessage}
        setExpressStage={setExpressStage}
        setDismissExpressPrompt={setDismissExpressPrompt}
        expressCategoryGroups={expressCategoryGroups}
        tagList={tagList}
        addExpressItem={addExpressItem}
        expressLines={expressLines}
        removeExpressLine={removeExpressLine}
        updateExpressLine={updateExpressLine}
        expressNotes={expressNotes}
        setExpressNotes={setExpressNotes}
        expressSubtotal={expressSubtotal}
        expressPayNow={expressPayNow}
        setExpressPayNow={setExpressPayNow}
        expressError={expressError}
        submitExpressPreOrder={submitExpressPreOrder}
        expressPaymentError={expressPaymentError}
        setExpressPaymentError={setExpressPaymentError}
        stripePromise={stripePromise}
        expressClientSecret={expressClientSecret}
        setExpressLoading={setExpressLoading}
        finalizeExpressPayment={finalizeExpressPayment}
        expressSubmitted={expressSubmitted}
        setStep={setStep}
        setSelectedTime={setSelectedTime}
        setPaymentClientSecret={setPaymentClientSecret}
        setPaymentError={setPaymentError}
        setPaymentProcessing={setPaymentProcessing}
        resetExpressState={resetExpressState}
        primary={primary}
      />
    );
  }

  if (step === "payment") {
    return (
      <DepositPayment
        wrapperClass={wrapperClass}
        embedded={embedded}
        textMutedClass={textMutedClass}
        paymentType={paymentType}
        formatCents={formatCents}
        depositMeta={depositMeta}
        paymentError={paymentError}
        stripePromise={stripePromise}
        paymentClientSecret={paymentClientSecret}
        paymentProcessing={paymentProcessing}
        setPaymentProcessing={setPaymentProcessing}
        setPaymentError={setPaymentError}
        onPaid={() => setStep("done")}
      />
    );
  }

  return (
    <DateTimePicker
      embedded={embedded}
      wrapperClass={wrapperClass}
      textMutedClass={textMutedClass}
      textSoftClass={textSoftClass}
      inputClass={inputClass}
      borderClass={borderClass}
      isDark={isDark}
      primary={primary}
      restaurantName={restaurantName}
      reserveHeading={reserveHeading}
      reserveSubheading={reserveSubheading}
      date={date}
      setDate={setDate}
      partySize={partySize}
      setPartySize={setPartySize}
      loading={loading}
      slots={slots}
      selectedTime={selectedTime}
      setSelectedTime={setSelectedTime}
      setStep={setStep}
      fmt={fmt}
    >
      {step === "form" && selectedTime && (
        <GuestDetails
          onSubmit={submit}
          borderClass={borderClass}
          selectedTime={selectedTime}
          partySize={partySize}
          date={date}
          fmt={fmt}
          depositApplies={depositApplies}
          availabilityDeposit={availabilityDeposit}
          depositMessage={depositMessage}
          formatCents={formatCents}
          error={error}
          name={name}
          setName={setName}
          phone={phone}
          setPhone={setPhone}
          email={email}
          setEmail={setEmail}
          loyaltyOptInEnabled={loyaltyOptInEnabled}
          isDark={isDark}
          loyaltyProgramName={loyaltyProgramName}
          loyaltyOptInMessage={loyaltyOptInMessage}
          loyaltyChecking={loyaltyChecking}
          textSoftClass={textSoftClass}
          normalizePhone={normalizePhone}
          loyaltyKnown={loyaltyKnown}
          loyaltyKnownOptIn={loyaltyKnownOptIn}
          canCaptureLoyalty={canCaptureLoyalty}
          loyaltyOptInChoice={loyaltyOptInChoice}
          setLoyaltyOptInChoice={setLoyaltyOptInChoice}
          loyaltyOptInLabel={loyaltyOptInLabel}
          reserveRequestPlaceholder={reserveRequestPlaceholder}
          notes={notes}
          setNotes={setNotes}
          textareaClass={textareaClass}
          reserveRequestSamples={reserveRequestSamples}
          applySample={applySample}
          inputClass={inputClass}
          reserveRequestDisclaimer={reserveRequestDisclaimer}
          primary={primary}
        />
      )}
    </DateTimePicker>
  );
}
