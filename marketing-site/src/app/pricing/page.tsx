import type { Metadata } from "next";
import PricingPageClient from "./pricing-page-client";

export const metadata: Metadata = {
  title: "Pricing",
  description: "ReserveSit pricing plans starting at $1,799 one-time. Core, Service Pro, and Full Suite options with optional managed hosting.",
};

export default function PricingPage() {
  return <PricingPageClient />;
}
