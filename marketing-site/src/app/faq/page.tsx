import type { Metadata } from "next";
import { FaqAccordion } from "@/components/faq-accordion";
import { fetchMarketingSettings, parseFaqItems, withMarketingDefaults } from "@/lib/marketing-settings";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Frequently asked questions about ReserveSit - pricing, setup, integrations, data ownership, and more.",
};

export default async function FaqPage() {
  const settings = withMarketingDefaults(await fetchMarketingSettings());
  const faqItems = parseFaqItems(settings.faq_items);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-bold text-slate-900">Frequently Asked Questions</h1>
      <p className="mt-3 text-slate-600">Everything you need to know before going live with ReserveSit.</p>
      <div className="mt-8">
        <FaqAccordion items={faqItems} />
      </div>
    </div>
  );
}
