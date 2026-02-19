"use client";

import type { FormEvent } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";

type StripePromise = ReturnType<typeof import("@stripe/stripe-js").loadStripe>;

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

  async function confirmCard(e: FormEvent) {
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
        {processing ? "Processing..." : `Pay $${(Math.max(0, Math.trunc(subtotal)) / 100).toFixed(2)} and Submit`}
      </button>
    </form>
  );
}

interface ConfirmationProps {
  wrapperClass: string;
  embedded: boolean;
  textMutedClass: string;
  textSoftClass: string;
  date: string;
  selectedTime: string;
  partySize: number;
  fmt: (time: string) => string;
  depositMeta: { required: boolean; amount: number; message: string | null };
  depositMessage: string;
  formatCents: (cents: number) => string;
  confirmCode: string;
  reserveConfirmationMessage: string;
  expressDiningEnabled: boolean;
  dismissExpressPrompt: boolean;
  expressStage: string;
  expressLoading: boolean;
  expressConfig: any;
  expressDiningMessage: string;
  setExpressStage: (value: any) => void;
  setDismissExpressPrompt: (value: boolean) => void;
  expressStarterCategories: any[];
  expressDrinkCategories: any[];
  tagList: (value: string | null | undefined) => string[];
  addExpressItem: (item: any, section: "starter" | "drink") => void;
  expressLines: any[];
  removeExpressLine: (key: string) => void;
  updateExpressLine: (key: string, patch: any) => void;
  expressNotes: string;
  setExpressNotes: (value: string) => void;
  expressSubtotal: number;
  expressPayNow: boolean;
  setExpressPayNow: (value: boolean) => void;
  expressError: string;
  submitExpressPreOrder: () => void;
  expressPaymentError: string;
  setExpressPaymentError: (value: string) => void;
  stripePromise: StripePromise | null;
  expressClientSecret: string;
  setExpressLoading: (value: boolean) => void;
  finalizeExpressPayment: () => Promise<void>;
  expressSubmitted: any;
  setStep: (value: "select" | "form" | "payment" | "done") => void;
  setSelectedTime: (value: string) => void;
  setPaymentClientSecret: (value: string) => void;
  setPaymentError: (value: string) => void;
  setPaymentProcessing: (value: boolean) => void;
  resetExpressState: () => void;
  primary: string;
}

export function Confirmation({
  wrapperClass,
  embedded,
  textMutedClass,
  textSoftClass,
  date,
  selectedTime,
  partySize,
  fmt,
  depositMeta,
  depositMessage,
  formatCents,
  confirmCode,
  reserveConfirmationMessage,
  expressDiningEnabled,
  dismissExpressPrompt,
  expressStage,
  expressLoading,
  expressConfig,
  expressDiningMessage,
  setExpressStage,
  setDismissExpressPrompt,
  expressStarterCategories,
  expressDrinkCategories,
  tagList,
  addExpressItem,
  expressLines,
  removeExpressLine,
  updateExpressLine,
  expressNotes,
  setExpressNotes,
  expressSubtotal,
  expressPayNow,
  setExpressPayNow,
  expressError,
  submitExpressPreOrder,
  expressPaymentError,
  setExpressPaymentError,
  stripePromise,
  expressClientSecret,
  setExpressLoading,
  finalizeExpressPayment,
  expressSubmitted,
  setStep,
  setSelectedTime,
  setPaymentClientSecret,
  setPaymentError,
  setPaymentProcessing,
  resetExpressState,
  primary,
}: ConfirmationProps) {
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
                expressStarterCategories.map((category: any) => (
                  <div key={`starter-${category.id}`} className="rounded-lg border border-gray-200 p-3">
                    <p className="text-sm font-semibold mb-2">{category.name}</p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {category.items.map((item: any) => (
                        <div key={item.id} className="rounded-lg border border-gray-100 p-2">
                          <p className="text-sm font-medium">{item.name}</p>
                          {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                          {tagList(item.dietaryTags).length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {tagList(item.dietaryTags).map((tag) => (
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
                expressDrinkCategories.map((category: any) => (
                  <div key={`drink-${category.id}`} className="rounded-lg border border-gray-200 p-3">
                    <p className="text-sm font-semibold mb-2">{category.name}</p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {category.items.map((item: any) => (
                        <div key={item.id} className="rounded-lg border border-gray-100 p-2">
                          <p className="text-sm font-medium">{item.name}</p>
                          {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                          {tagList(item.dietaryTags).length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {tagList(item.dietaryTags).map((tag) => (
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
                  {expressLines.map((line: any) => (
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
