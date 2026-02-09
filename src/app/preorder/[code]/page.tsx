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
  type?: string;
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
  menuItem?: {
    id: number;
    name: string;
    category?: { type?: string | null } | null;
  };
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
  quantity: number;
  specialInstructions: string;
  price: number;
  section: "starter" | "drink";
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

function categorySection(type?: string | null): "starter" | "drink" {
  return String(type || "starter").toLowerCase() === "drink" ? "drink" : "starter";
}

function PaymentStep({
  subtotal,
  onConfirmed,
  onBack,
}: {
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

  const starterCategories = useMemo(
    () => categories.filter(category => categorySection(category.type) === "starter"),
    [categories],
  );
  const drinkCategories = useMemo(
    () => categories.filter(category => categorySection(category.type) === "drink"),
    [categories],
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
      const lookupRes = await fetch(`/api/preorder?code=${encodeURIComponent(code)}&phone=${encodeURIComponent(phone)}`);
      const lookupData = await lookupRes.json();
      if (!lookupRes.ok) {
        setError(lookupData.error || "We couldn't verify that reservation.");
        return;
      }

      const menuRes = await fetch("/api/menu/categories?public=true");
      const menuData = await menuRes.json();
      if (!menuRes.ok) {
        setError(menuData.error || "Menu is unavailable right now.");
        return;
      }

      const list = Array.isArray(menuData)
        ? (menuData as MenuCategory[])
            .filter(category => ["starter", "drink"].includes(String(category.type || "starter").toLowerCase()))
            .filter(category => Array.isArray(category.items) && category.items.length > 0)
        : [];

      setCategories(list);
      setReservation(lookupData.reservation);
      setConfig(lookupData.config);
      setCutoffOpen(Boolean(lookupData.cutoffOpen));
      setExisting(lookupData.preOrder || null);
      setCurrentPreOrderId(lookupData.preOrder?.id || null);
      setSpecialNotes(String(lookupData.preOrder?.specialNotes || ""));
      setVerified(true);
      setStep("editor");

      const sectionMap = new Map<number, "starter" | "drink">();
      for (const category of list) {
        for (const item of category.items) {
          sectionMap.set(item.id, categorySection(category.type));
        }
      }

      const existingLines = (lookupData.preOrder?.items || []).map((item: PreOrderItem, index: number) => ({
        key: `existing-${item.id || index}`,
        menuItemId: item.menuItemId,
        itemName: item.menuItem?.name || `Item ${item.menuItemId}`,
        quantity: Math.max(1, Number(item.quantity || 1)),
        specialInstructions: item.specialInstructions || "",
        price: Number(item.price || 0),
        section: sectionMap.get(item.menuItemId) || categorySection(item.menuItem?.category?.type),
      }));
      setLines(existingLines);
    } finally {
      setLoading(false);
    }
  }

  function addItem(menuItem: MenuItem, section: "starter" | "drink") {
    setLines(prev => {
      const existingIndex = prev.findIndex(line => line.menuItemId === menuItem.id && line.specialInstructions.trim() === "");
      if (existingIndex >= 0) {
        return prev.map((line, idx) => (idx === existingIndex ? { ...line, quantity: line.quantity + 1 } : line));
      }
      return [
        ...prev,
        {
          key: `${menuItem.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          menuItemId: menuItem.id,
          itemName: menuItem.name,
          quantity: 1,
          specialInstructions: "",
          price: Number(menuItem.price || 0),
          section,
        },
      ];
    });
  }

  function removeLine(key: string) {
    setLines(prev => prev.filter(line => line.key !== key));
  }

  function updateLine(key: string, patch: Partial<OrderLine>) {
    setLines(prev => prev.map(line => (line.key === key ? { ...line, ...patch } : line)));
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
      const effectivePayNow = config.payment === "precharge"
        ? true
        : config.payment === "optional"
          ? payNow
          : false;

      const payload = {
        reservationCode: reservation.code,
        phone,
        specialNotes,
        items: lines.map(line => ({
          menuItemId: line.menuItemId,
          quantity: line.quantity,
          specialInstructions: line.specialInstructions || undefined,
        })),
        payNow: effectivePayNow,
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

      const preOrder = (data.preOrder || data) as PreOrderRecord;
      setExisting(preOrder);
      setCurrentPreOrderId(preOrder.id);

      const returnedSecret = String(data.clientSecret || "");
      if (returnedSecret) {
        setClientSecret(returnedSecret);
        setStep("payment");
        return;
      }

      setStep("done");
      setSuccessMessage("Starters & drinks submitted successfully.");
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
    setExisting((data.preOrder || data) as PreOrderRecord);
    setStep("done");
    setSuccessMessage("Starters & drinks submitted and paid.");
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
      setExisting((data.preOrder || null) as PreOrderRecord | null);
      setLines([]);
      setStep("done");
      setSuccessMessage("Pre-order cancelled.");
    } finally {
      setLoading(false);
    }
  }

  const starterLines = useMemo(
    () => lines.filter(line => line.section === "starter"),
    [lines],
  );
  const drinkLines = useMemo(
    () => lines.filter(line => line.section === "drink"),
    [lines],
  );

  if (!verified) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-10">
        <div className="max-w-xl mx-auto bg-white rounded-xl shadow p-6">
          <h1 className="text-2xl font-bold">Pre-Order Starters & Drinks</h1>
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
      <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_340px] gap-4">
        <section className="space-y-4">
          <div className="bg-white rounded-xl shadow p-4 sm:p-6">
            <h1 className="text-2xl font-bold">Express Dining</h1>
            <p className="text-sm text-gray-600 mt-1">{config.message}</p>
            <div className="mt-3 text-sm text-gray-700">
              {reservation.guestName} · Party of {reservation.partySize} · {reservation.date} at {formatTime12(reservation.time)}
            </div>
            {!cutoffOpen && (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                Pre-ordering is closed for this reservation. You can order at the restaurant.
              </div>
            )}
            {existing && existing.status !== "cancelled" && (
              <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                Existing pre-order found. You can edit or cancel it before cutoff.
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow p-4 sm:p-6 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">🍽</span>
                <h2 className="text-lg font-bold">Starters</h2>
              </div>
              {starterCategories.length === 0 ? (
                <p className="text-sm text-gray-500">No starter items available.</p>
              ) : (
                <div className="space-y-3">
                  {starterCategories.map(category => (
                    <div key={`starter-${category.id}`} className="rounded-lg border border-gray-200 p-3">
                      <h3 className="text-sm font-semibold mb-2">{category.name}</h3>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {category.items.map(item => (
                          <div key={item.id} className="rounded-lg border border-gray-100 p-2">
                            <p className="text-sm font-medium">{item.name}</p>
                            {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                            {tags(item.dietaryTags).length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {tags(item.dietaryTags).map(tag => (
                                  <span key={`${item.id}-${tag}`} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{tag}</span>
                                ))}
                              </div>
                            )}
                            {config.mode === "prices" && typeof item.price === "number" && (
                              <p className="text-xs font-semibold mt-1">{formatCents(item.price)}</p>
                            )}
                            <button
                              type="button"
                              onClick={() => addItem(item, "starter")}
                              disabled={!cutoffOpen}
                              className="mt-2 h-9 px-3 rounded bg-blue-600 text-white text-xs font-medium disabled:opacity-50"
                            >
                              + Add
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">🥂</span>
                <h2 className="text-lg font-bold">Drinks</h2>
              </div>
              {drinkCategories.length === 0 ? (
                <p className="text-sm text-gray-500">No drink items available.</p>
              ) : (
                <div className="space-y-3">
                  {drinkCategories.map(category => (
                    <div key={`drink-${category.id}`} className="rounded-lg border border-gray-200 p-3">
                      <h3 className="text-sm font-semibold mb-2">{category.name}</h3>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {category.items.map(item => (
                          <div key={item.id} className="rounded-lg border border-gray-100 p-2">
                            <p className="text-sm font-medium">{item.name}</p>
                            {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                            {tags(item.dietaryTags).length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {tags(item.dietaryTags).map(tag => (
                                  <span key={`${item.id}-${tag}`} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{tag}</span>
                                ))}
                              </div>
                            )}
                            {config.mode === "prices" && typeof item.price === "number" && (
                              <p className="text-xs font-semibold mt-1">{formatCents(item.price)}</p>
                            )}
                            <button
                              type="button"
                              onClick={() => addItem(item, "drink")}
                              disabled={!cutoffOpen}
                              className="mt-2 h-9 px-3 rounded bg-blue-600 text-white text-xs font-medium disabled:opacity-50"
                            >
                              + Add
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="bg-white rounded-xl shadow p-4">
            <h2 className="font-bold">Order summary</h2>
            {lines.length === 0 ? (
              <p className="text-sm text-gray-500 mt-3">No items added yet.</p>
            ) : (
              <div className="mt-3 space-y-3 max-h-[420px] overflow-auto">
                <div>
                  <div className="text-xs font-semibold text-gray-500 mb-1">STARTERS</div>
                  <div className="space-y-2">
                    {starterLines.length === 0 && <p className="text-xs text-gray-400">None</p>}
                    {starterLines.map(line => (
                      <div key={line.key} className="rounded border p-2">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span>{line.quantity}x {line.itemName}</span>
                          <button type="button" onClick={() => removeLine(line.key)} className="text-red-600 text-xs">Remove</button>
                        </div>
                        <div className="mt-1 grid grid-cols-[88px_1fr] gap-2">
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

                <div>
                  <div className="text-xs font-semibold text-gray-500 mb-1">DRINKS</div>
                  <div className="space-y-2">
                    {drinkLines.length === 0 && <p className="text-xs text-gray-400">None</p>}
                    {drinkLines.map(line => (
                      <div key={line.key} className="rounded border p-2">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span>{line.quantity}x {line.itemName}</span>
                          <button type="button" onClick={() => removeLine(line.key)} className="text-red-600 text-xs">Remove</button>
                        </div>
                        <div className="mt-1 grid grid-cols-[88px_1fr] gap-2">
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
              </div>
            )}

            <textarea
              value={specialNotes}
              onChange={e => setSpecialNotes(e.target.value)}
              placeholder="Any requests for the kitchen?"
              rows={2}
              className="w-full mt-3 border rounded px-3 py-2 text-sm"
            />

            {config.mode === "prices" && (
              <div className="mt-3 text-sm font-semibold">Subtotal: {formatCents(subtotal)}</div>
            )}

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
