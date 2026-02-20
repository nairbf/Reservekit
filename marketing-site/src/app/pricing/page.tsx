import type { Metadata } from "next";
import PricingPageClient from "./pricing-page-client";

export const metadata: Metadata = {
  title: "Pricing",
  description: "ReserveSit pricing plans starting at $2,199 one-time. Core, Service Pro, and Full Suite with first-year managed hosting included.",
};

export default function PricingPage() {
  return <PricingPageClient />;
}
