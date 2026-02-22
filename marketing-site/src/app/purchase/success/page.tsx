import Link from "next/link";
import { appUrl, getStripe } from "@/lib/stripe";

interface SuccessPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function asString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

export default async function PurchaseSuccessPage({ searchParams }: SuccessPageProps) {
  const params = await searchParams;
  const sessionId = asString(params.session_id);
  const isUpgrade = asString(params.upgrade) === "true";

  let sessionSummary: {
    customerEmail: string;
    plan: string;
    addons: string;
    hosting: string;
    amountTotal: string;
    lineItems: string[];
  } | null = null;

  if (sessionId && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["line_items.data.price"],
      });

      const amount = typeof session.amount_total === "number" ? session.amount_total / 100 : 0;
      const formatted = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

      const lineItems = ((session.line_items?.data || []) as Array<{ description?: string; quantity?: number }>)
        .map((item) => `${item.description || "Item"}${item.quantity && item.quantity > 1 ? ` × ${item.quantity}` : ""}`)
        .filter(Boolean);

      sessionSummary = {
        customerEmail: session.customer_details?.email || session.customer_email || "",
        plan: session.metadata?.plan || "",
        addons: session.metadata?.addons || "",
        hosting: session.metadata?.hosting || "none",
        amountTotal: formatted,
        lineItems,
      };
    } catch (error) {
      console.error("[CHECKOUT SUCCESS] Could not load session", error);
    }
  }

  const showTrial = sessionSummary?.hosting && sessionSummary.hosting !== "none";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-sm text-emerald-900">
        Payment confirmed. Thank you for choosing ReserveSit.
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">Thank you for your purchase!</h1>
        <p className="mt-2 text-sm text-slate-600">
          {isUpgrade
            ? "Your plan upgrade payment was successful."
            : "Your order is confirmed and provisioning is now queued."}
        </p>

        {sessionSummary ? (
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Order Summary</h2>
            <ul className="mt-3 space-y-1 text-sm text-slate-700">
              {sessionSummary.lineItems.length > 0 ? (
                sessionSummary.lineItems.map((line) => <li key={line}>• {line}</li>)
              ) : (
                <li>• Plan: {sessionSummary.plan || "N/A"}</li>
              )}
            </ul>
            <p className="mt-3 text-sm text-slate-700">Total charged now: <span className="font-semibold">{sessionSummary.amountTotal}</span></p>
            {sessionSummary.customerEmail ? (
              <p className="mt-1 text-sm text-slate-700">Receipt sent to: <span className="font-semibold">{sessionSummary.customerEmail}</span></p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6">
          <h2 className="text-lg font-semibold text-slate-900">What happens next</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
            <li>Our team reviews your order and starts provisioning your restaurant environment.</li>
            <li>You receive onboarding details and credentials within 24 hours.</li>
            <li>We help you configure tables, hours, and launch reservations.</li>
          </ol>
          {showTrial ? (
            <p className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
              Your first year of managed hosting is included free.
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/pricing" className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700">
            Back to Pricing
          </Link>
          <a href="mailto:support@reservesit.com" className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white">
            Contact Support
          </a>
          <a href={`${appUrl()}/portal`} className="inline-flex h-10 items-center justify-center rounded-lg border border-blue-300 bg-blue-50 px-4 text-sm font-medium text-blue-700">
            Check Status
          </a>
        </div>
      </section>
    </div>
  );
}
