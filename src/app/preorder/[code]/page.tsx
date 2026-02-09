"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

interface MenuItem {
  id: number;
  name: string;
  description: string | null;
  price?: number;
  dietaryTags: string | null;
}

interface MenuCategory {
  id: number;
  name: string;
  items: MenuItem[];
}

interface ReservationSummary {
  id: number;
  code: string;
  guestName: string;
  date: string;
  time: string;
  partySize: number;
  status: string;
}

interface PreOrderItem {
  id?: number;
  menuItemId: number;
  guestLabel: string;
  quantity: number;
  specialInstructions: string | null;
  price: number;
  menuItem?: MenuItem;
}

interface PreOrderRecord {
  id: number;
  status: string;
  specialNotes: string | null;
  subtotal: number;
  isPaid: boolean;
  paidAmount: number | null;
  items: PreOrderItem[];
}

interface ExpressConfig {
  mode: "prices" | "browse";
  payment: "precharge" | "optional" | "none";
  cutoffHours: number;
  message: string;
}

interface OrderLine {
  key: string;
  menuItemId: number;
  itemName: string;
  guestLabel: string;
  quantity: number;
  specialInstructions: string;
  price: number;
}

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

function formatCents(cents: number): string {
  return `$${(Math.max(0, Math.trunc(cents)) / 100).toFixed(2)}`;
}

function formatTime12(value: string): string {
  const match = (value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return value;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  const h = hour % 12 || 12;
  return `${h}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

function tags(value: string | null | undefined): string[] {
  return String(value || "")
    .split(",")
    .map(v => v.trim())
    .filter(Boolean);
}

function buildGuestsPayload(lines: OrderLine[], guestLabels: string[]) {
  return guestLabels.map(label => ({
    label,
    items: lines
      .filter(line => line.guestLabel === label)
      .map(line => ({
        menuItemId: line.menuItemId,
        quantity: line.quantity,
        specialInstructions: line.specialInstructions || undefined,
      })),
  }));
}

function PaymentStep({
  clientSecret,
  subtotal,
  onConfirmed,
  onBack,
}: {
  clientSecret: string;
  subtotal: number;
  onConfirmed: () => Promise<void>;
  onBack: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setError("");
    setProcessing(true);
    try {
      const result = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
      });
      if (result.error) {
        setError(result.error.message || "Payment failed.");
        return;
      }
      const status = result.paymentIntent?.status;
      if (status !== "succeeded" && status !== "requires_capture" && status !== "processing") {
        setError("Payment is not complete yet.");
        return;
      }
      await onConfirmed();
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow p-4 sm:p-6">
      <h2 className="text-xl font-bold mb-1">Confirm payment</h2>
      <p className="text-sm text-gray-600 mb-3">Subtotal: {formatCents(subtotal)}</p>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <form onSubmit={submit} className="space-y-3">
        <div className="rounded-lg border border-gray-200 p-3">
          <PaymentElement options={{ layout: "tabs" }} />
        </div>
        <button
          type="submit"
          disabled={processing || !stripe || !elements}
          className="w-full h-11 rounded bg-blue-600 text-white font-medium transition-all duration-200 disabled:opacity-60"
        >
          {processing ? "Processing..." : "Pay and Submit Pre-Order"}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="w-full h-11 rounded border border-gray-200 text-gray-700 font-medium transition-all duration-200"
        >
          Back
        </button>
      </form>
    </div>
  );
}

export default function PreOrderPage() {
  const params = useParams<{ code: string }>();
  const code = String(params.code || "").toUpperCase();

  const [phone, setPhone] = useState("");
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [reservation, setReservation] = useState<ReservationSummary | null>(null);
  const [config, setConfig] = useState<ExpressConfig | null>(null);
  const [cutoffOpen, setCutoffOpen] = useState(true);
  const [existing, setExisting] = useState<PreOrderRecord | null>(null);

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [openCategoryIds, setOpenCategoryIds] = useState<number[]>([]);
  const [guestLabels, setGuestLabels] = useState<string[]>([]);
  const [activeGuestIndex, setActiveGuestIndex] = useState(0);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [specialNotes, setSpecialNotes] = useState("");
  const [payNow, setPayNow] = useState(false);

  const [step, setStep] = useState<"editor" | "payment" | "done">("editor");
  const [clientSecret, setClientSecret] = useState("");
  const [currentPreOrderId, setCurrentPreOrderId] = useState<number | null>(null);

  const subtotal = useMemo(
    () => lines.reduce((sum, line) => sum + line.price * line.quantity, 0),
    [lines],
  );

  useEffect(() => {
    if (!config) return;
    if (config.payment === "precharge") setPayNow(true);
  }, [config]);

  async function verifyReservation() {
    if (!phone.trim()) return;
    setLoading(true);
    setError("");
    setSuccessMessage("");
    try {
      const res = await fetch(`/api/preorder?code=${encodeURIComponent(code)}&phone=${encodeURIComponent(phone)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "We couldn't verify that reservation.");
        return;
      }

      const menuRes = await fetch("/api/menu/categories?public=true");
      const menuData = await menuRes.json();
      setCategories(Array.isArray(menuData) ? menuData : []);
      setOpenCategoryIds(Array.isArray(menuData) ? menuData.map((c: MenuCategory) => c.id) : []);

      setReservation(data.reservation);
      setConfig(data.config);
      setCutoffOpen(Boolean(data.cutoffOpen));
      setExisting(data.preOrder || null);
      setCurrentPreOrderId(data.preOrder?.id || null);
      setSpecialNotes(String(data.preOrder?.specialNotes || ""));
      setVerified(true);
      setStep("editor");

      const baseLabels = Array.from({ length: Math.max(1, Number(data.reservation?.partySize || 1)) }, (_, i) => `Guest ${i + 1}`);
      const existingLabels = Array.from(
        new Set((data.preOrder?.items || []).map((item: PreOrderItem) => item.guestLabel).filter(Boolean)),
      ) as string[];
      const mergedLabels = existingLabels.length > 0 ? existingLabels : baseLabels;
      setGuestLabels(mergedLabels);

      const existingLines = (data.preOrder?.items || []).map((item: PreOrderItem, index: number) => ({
        key: `existing-${item.id || index}`,
        menuItemId: item.menuItemId,
        itemName: item.menuItem?.name || `Item ${item.menuItemId}`,
        guestLabel: item.guestLabel,
        quantity: item.quantity,
        specialInstructions: item.specialInstructions || "",
        price: item.price,
      }));
      setLines(existingLines);
    } finally {
      setLoading(false);
    }
  }

  function addItem(menuItem: MenuItem) {
    const guestLabel = guestLabels[activeGuestIndex] || "Guest 1";
    setLines(prev => [
      ...prev,
      {
        key: `${guestLabel}-${menuItem.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        menuItemId: menuItem.id,
        itemName: menuItem.name,
        guestLabel,
        quantity: 1,
        specialInstructions: "",
        price: Number(menuItem.price || 0),
      },
    ]);
  }

  function removeLine(key: string) {
    setLines(prev => prev.filter(line => line.key !== key));
  }

  function updateLine(key: string, patch: Partial<OrderLine>) {
    setLines(prev => prev.map(line => (line.key === key ? { ...line, ...patch } : line)));
  }

  function renameGuest(index: number, name: string) {
    const clean = name.trim() || `Guest ${index + 1}`;
    const previous = guestLabels[index] || `Guest ${index + 1}`;
    setGuestLabels(prev => prev.map((label, i) => (i === index ? clean : label)));
    setLines(prev => prev.map(line => (line.guestLabel === previous ? { ...line, guestLabel: clean } : line)));
  }

  async function submitPreOrder() {
    if (!reservation || !config) return;
    if (lines.length === 0) {
      setError("Add at least one item before submitting.");
      return;
    }
    if (config.payment === "precharge" && !payNow) {
      setError("Payment is required for this pre-order.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMessage("");
    try {
      const payload = {
        reservationCode: reservation.code,
        phone,
        specialNotes,
        guests: buildGuestsPayload(lines, guestLabels),
        payNow,
      };

      const endpoint = existing ? `/api/preorder/${existing.id}` : "/api/preorder";
      const method = existing ? "PUT" : "POST";
      const body = existing ? { ...payload, code: reservation.code } : payload;
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not submit pre-order.");
        return;
      }

      const preOrder = data.preOrder || data;
      setExisting(preOrder);
      setCurrentPreOrderId(preOrder.id);

      const returnedSecret = String(data.clientSecret || "");
      if (returnedSecret) {
        setClientSecret(returnedSecret);
        setStep("payment");
        return;
      }

      setStep("done");
      setSuccessMessage("Pre-order submitted successfully.");
    } finally {
      setLoading(false);
    }
  }

  async function markPaidAndFinish() {
    if (!currentPreOrderId || !reservation) return;
    const res = await fetch(`/api/preorder/${currentPreOrderId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "mark_paid",
        code: reservation.code,
        phone,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not finalize payment.");
      return;
    }
    setExisting(data.preOrder || data);
    setStep("done");
    setSuccessMessage("Pre-order submitted and paid.");
  }

  async function cancelPreOrder() {
    if (!existing || !reservation) return;
    if (!confirm("Cancel this pre-order?")) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/preorder/${existing.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: reservation.code, phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not cancel pre-order.");
        return;
      }
      setExisting(data.preOrder || null);
      setLines([]);
      setStep("done");
      setSuccessMessage("Pre-order cancelled.");
    } finally {
      setLoading(false);
    }
  }

  const grouped = useMemo(() => {
    const map: Record<string, OrderLine[]> = {};
    for (const line of lines) {
      if (!map[line.guestLabel]) map[line.guestLabel] = [];
      map[line.guestLabel].push(line);
    }
    return map;
  }, [lines]);

  if (!verified) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-10">
        <div className="max-w-xl mx-auto bg-white rounded-xl shadow p-6">
          <h1 className="text-2xl font-bold">Pre-Order Your Meal</h1>
          <p className="text-sm text-gray-600 mt-2">
            Enter your phone number to access reservation {code}.
          </p>
          <div className="mt-4 space-y-3">
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Phone number used for reservation"
              className="w-full h-11 border rounded px-3"
            />
            <button
              onClick={verifyReservation}
              disabled={loading}
              className="w-full h-11 rounded bg-blue-600 text-white font-medium transition-all duration-200 disabled:opacity-60"
            >
              {loading ? "Verifying..." : "Continue"}
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </div>
      </div>
    );
  }

  if (!reservation || !config) {
    return <div className="min-h-screen bg-gray-50 px-4 py-10 text-center text-gray-500">Unable to load reservation details.</div>;
  }

  if (step === "payment" && clientSecret) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-10">
        <div className="max-w-2xl mx-auto">
          {!stripePromise ? (
            <div className="bg-white rounded-xl shadow p-6 text-red-600">Stripe is not configured.</div>
          ) : (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <PaymentStep
                clientSecret={clientSecret}
                subtotal={subtotal}
                onConfirmed={markPaidAndFinish}
                onBack={() => setStep("editor")}
              />
            </Elements>
          )}
        </div>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-10">
        <div className="max-w-2xl mx-auto bg-white rounded-xl shadow p-6">
          <h1 className="text-2xl font-bold mb-2">Pre-Order Update</h1>
          <p className="text-sm text-gray-600">{successMessage || "Your pre-order has been updated."}</p>
          {existing && (
            <div className="mt-4 rounded-lg border p-3 text-sm">
              <p><span className="font-medium">Status:</span> {existing.status.replaceAll("_", " ")}</p>
              <p><span className="font-medium">Subtotal:</span> {formatCents(existing.subtotal)}</p>
              <p><span className="font-medium">Paid:</span> {existing.isPaid ? "Yes" : "No"}</p>
            </div>
          )}
          <button
            onClick={() => setStep("editor")}
            className="mt-4 h-11 px-4 rounded bg-blue-600 text-white font-medium"
          >
            Back to pre-order
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_320px] gap-4">
        <section className="space-y-4">
          <div className="bg-white rounded-xl shadow p-4 sm:p-6">
            <h1 className="text-2xl font-bold">Express Dining</h1>
            <p className="text-sm text-gray-600 mt-1">{config.message}</p>
            <div className="mt-3 text-sm text-gray-700">
              {reservation.guestName} · {reservation.partySize} guests · {reservation.date} at {formatTime12(reservation.time)}
            </div>
            {!cutoffOpen && (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                Pre-ordering is closed for this reservation. You can order at the restaurant.
              </div>
            )}
            {existing && (
              <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                Existing pre-order found. You can edit or cancel it before cutoff.
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow p-4 sm:p-6">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {guestLabels.map((label, idx) => (
                <button
                  key={`${label}-${idx}`}
                  type="button"
                  onClick={() => setActiveGuestIndex(idx)}
                  className={`h-10 px-3 rounded-lg border text-sm ${activeGuestIndex === idx ? "bg-blue-600 text-white border-blue-600" : "bg-white border-gray-200 text-gray-700"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mb-4">
              {guestLabels.map((label, idx) => (
                <input
                  key={`rename-${idx}`}
                  value={label}
                  onChange={e => renameGuest(idx, e.target.value)}
                  className="h-10 border rounded px-3 text-sm"
                />
              ))}
            </div>

            <div className="space-y-3">
              {categories.map(category => {
                const open = openCategoryIds.includes(category.id);
                return (
                  <div key={category.id} className="border rounded-lg">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenCategoryIds(prev =>
                          prev.includes(category.id) ? prev.filter(id => id !== category.id) : [...prev, category.id],
                        )
                      }
                      className="w-full px-3 py-2 text-left font-semibold bg-gray-50"
                    >
                      {category.name}
                    </button>
                    {open && (
                      <div className="p-3 grid sm:grid-cols-2 gap-3">
                        {category.items.map(item => (
                          <div key={item.id} className="border rounded-lg p-3">
                            <div className="font-medium">{item.name}</div>
                            {item.description && <div className="text-xs text-gray-500 mt-1">{item.description}</div>}
                            <div className="mt-2 flex flex-wrap gap-1">
                              {tags(item.dietaryTags).map(tag => (
                                <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{tag}</span>
                              ))}
                            </div>
                            {config.mode === "prices" && typeof item.price === "number" && (
                              <div className="text-sm font-semibold mt-2">{formatCents(item.price)}</div>
                            )}
                            <button
                              type="button"
                              disabled={!cutoffOpen}
                              onClick={() => addItem(item)}
                              className="mt-2 h-10 px-3 rounded bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
                            >
                              + Add
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="bg-white rounded-xl shadow p-4">
            <h2 className="font-bold">Order summary</h2>
            <div className="mt-3 space-y-3 max-h-[420px] overflow-auto">
              {guestLabels.map(label => (
                <div key={label}>
                  <div className="text-sm font-semibold mb-1">{label}</div>
                  <div className="space-y-2">
                    {(grouped[label] || []).map(line => (
                      <div key={line.key} className="rounded border p-2">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span>{line.quantity}x {line.itemName}</span>
                          <button type="button" onClick={() => removeLine(line.key)} className="text-red-600 text-xs">Remove</button>
                        </div>
                        <div className="mt-1 grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            min={1}
                            value={line.quantity}
                            onChange={e => updateLine(line.key, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                            className="h-8 border rounded px-2 text-xs"
                          />
                          <input
                            value={line.specialInstructions}
                            onChange={e => updateLine(line.key, { specialInstructions: e.target.value })}
                            placeholder="Instructions"
                            className="h-8 border rounded px-2 text-xs"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {lines.length === 0 && <p className="text-sm text-gray-500">No items added yet.</p>}
            </div>
            <textarea
              value={specialNotes}
              onChange={e => setSpecialNotes(e.target.value)}
              placeholder="Table notes (anniversary, in a rush, etc.)"
              rows={2}
              className="w-full mt-3 border rounded px-3 py-2 text-sm"
            />
            <div className="mt-3 text-sm font-semibold">Subtotal: {formatCents(subtotal)}</div>
            {config.payment === "optional" && (
              <label className="flex items-center gap-2 text-sm mt-2">
                <input type="checkbox" checked={payNow} onChange={e => setPayNow(e.target.checked)} className="h-4 w-4" />
                Pay now
              </label>
            )}
            {config.payment === "precharge" && (
              <div className="mt-2 text-xs text-amber-700 rounded border border-amber-300 bg-amber-50 p-2">
                Payment is required to confirm your pre-order.
              </div>
            )}
            <button
              type="button"
              disabled={loading || !cutoffOpen}
              onClick={submitPreOrder}
              className="w-full h-11 mt-3 rounded bg-blue-600 text-white font-medium disabled:opacity-50"
            >
              {loading ? "Saving..." : existing ? "Update Pre-Order" : "Submit Pre-Order"}
            </button>
            {existing && cutoffOpen && (
              <button
                type="button"
                onClick={cancelPreOrder}
                className="w-full h-11 mt-2 rounded border border-red-300 text-red-700 font-medium"
              >
                Cancel Pre-Order
              </button>
            )}
            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}

