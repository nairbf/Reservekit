"use client";

import type { FormEvent } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";

type StripePromise = ReturnType<typeof import("@stripe/stripe-js").loadStripe>;

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
            ? `Place Card Hold ($${(Math.max(0, Math.trunc(amountCents)) / 100).toFixed(2)})`
            : `Pay Deposit ($${(Math.max(0, Math.trunc(amountCents)) / 100).toFixed(2)})`}
      </button>
    </form>
  );
}

interface DepositPaymentProps {
  wrapperClass: string;
  embedded: boolean;
  textMutedClass: string;
  paymentType: "hold" | "deposit";
  formatCents: (cents: number) => string;
  depositMeta: { amount: number; message: string | null };
  paymentError: string;
  stripePromise: StripePromise | null;
  paymentClientSecret: string;
  paymentProcessing: boolean;
  setPaymentProcessing: (next: boolean) => void;
  setPaymentError: (message: string) => void;
  onPaid: () => void;
}

export function DepositPayment({
  wrapperClass,
  embedded,
  textMutedClass,
  paymentType,
  formatCents,
  depositMeta,
  paymentError,
  stripePromise,
  paymentClientSecret,
  paymentProcessing,
  setPaymentProcessing,
  setPaymentError,
  onPaid,
}: DepositPaymentProps) {
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
              onPaid={onPaid}
            />
          </Elements>
        )}
      </div>
    </div>
  );
}
