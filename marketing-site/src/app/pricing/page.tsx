import { PricingCards } from "@/components/pricing-cards";
import { ComparisonTable } from "@/components/comparison-table";

export default function PricingPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-bold text-slate-900">Pricing</h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        Pick the plan that matches your operation. Add-ons can be purchased anytime.
      </p>

      <div className="mt-10">
        <PricingCards />
      </div>

      <div className="mt-12">
        <h2 className="text-2xl font-semibold text-slate-900">Comparison</h2>
        <div className="mt-5">
          <ComparisonTable />
        </div>
      </div>
    </div>
  );
}
