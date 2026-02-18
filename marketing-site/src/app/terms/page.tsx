import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | ReserveSit",
  description: "ReserveSit Terms of Service",
};

const sections = [
  { id: "acceptance", title: "1. Acceptance of Terms" },
  { id: "service-description", title: "2. Description of Service" },
  { id: "account-registration", title: "3. Account Registration" },
  { id: "billing", title: "4. Subscription and Payments" },
  { id: "acceptable-use", title: "5. Acceptable Use" },
  { id: "restaurant-responsibilities", title: "6. Restaurant Responsibilities" },
  { id: "guest-terms", title: "7. Guest Terms" },
  { id: "ip", title: "8. Intellectual Property" },
  { id: "privacy", title: "9. Data and Privacy" },
  { id: "availability", title: "10. Service Availability" },
  { id: "liability", title: "11. Limitation of Liability" },
  { id: "indemnification", title: "12. Indemnification" },
  { id: "termination", title: "13. Termination" },
  { id: "disputes", title: "14. Dispute Resolution" },
  { id: "changes", title: "15. Changes to Terms" },
  { id: "contact", title: "16. Contact" },
];

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 text-2xl font-semibold text-slate-900">
      {children}
    </h2>
  );
}

export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
      <Link href="/" className="text-sm font-medium text-blue-700 hover:text-blue-800">
        ← Back to Home
      </Link>

      <header className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Legal</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">Terms of Service</h1>
        <p className="mt-3 text-sm text-slate-600">
          Last updated: February 2026
          <br />
          These Terms of Service ("Terms") govern your use of the ReserveSit platform provided by ReserveSit, LLC
          ("ReserveSit," "we," "our," or "us") at <a className="text-blue-700 underline" href="https://reservesit.com">reservesit.com</a>.
        </p>
      </header>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="text-lg font-semibold text-slate-900">Table of Contents</h2>
        <ul className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
          {sections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className="hover:text-blue-700 hover:underline">
                {section.title}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <article className="mt-8 space-y-10 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <section className="space-y-3">
          <SectionHeading id="acceptance">1. Acceptance of Terms</SectionHeading>
          <p className="text-sm leading-7 text-slate-700">
            By creating an account, accessing, or using ReserveSit, you agree to these Terms. If you do not agree,
            you must not use the service.
          </p>
        </section>

        <section className="space-y-3">
          <SectionHeading id="service-description">2. Description of Service</SectionHeading>
          <p className="text-sm leading-7 text-slate-700">
            ReserveSit is a restaurant reservation and operations platform that provides booking workflows, guest
            communication tools, waitlist features, and related management functions through a multi-tenant SaaS model.
          </p>
        </section>

        <section className="space-y-3">
          <SectionHeading id="account-registration">3. Account Registration</SectionHeading>
          <ul className="list-disc space-y-2 pl-6 text-sm leading-7 text-slate-700">
            <li>You must provide accurate and complete business and contact information.</li>
            <li>You are responsible for maintaining the confidentiality of account credentials.</li>
            <li>You are responsible for activity occurring under your account.</li>
            <li>Unless otherwise agreed, each location requires its own account and configuration.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <SectionHeading id="billing">4. Subscription and Payments</SectionHeading>
          <ul className="list-disc space-y-2 pl-6 text-sm leading-7 text-slate-700">
            <li>Available plans include Core, Service Pro, and Full Suite.</li>
            <li>Subscriptions are billed monthly unless a separate written plan applies.</li>
            <li>Payments are processed by Stripe under Stripe's terms and privacy policies.</li>
            <li>We may adjust pricing with at least 30 days' advance notice.</li>
            <li>Monthly fees are generally non-refundable; annual plans may be eligible for prorated refunds where required by contract or law.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <SectionHeading id="acceptable-use">5. Acceptable Use</SectionHeading>
          <p className="text-sm leading-7 text-slate-700">You agree not to:</p>
          <ul className="list-disc space-y-2 pl-6 text-sm leading-7 text-slate-700">
            <li>Use the service for unlawful, fraudulent, or abusive activities.</li>
            <li>Scrape, reverse engineer, or attempt unauthorized access to the platform.</li>
            <li>Send spam or harmful communications through ReserveSit systems.</li>
            <li>Disrupt service availability or interfere with other users.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <SectionHeading id="restaurant-responsibilities">6. Restaurant Responsibilities</SectionHeading>
          <ul className="list-disc space-y-2 pl-6 text-sm leading-7 text-slate-700">
            <li>Maintain accurate reservation rules, menu details, operating hours, and contact information.</li>
            <li>Honor confirmed reservations and clearly communicate restaurant-specific policies.</li>
            <li>Comply with applicable laws and regulations, including food safety, accessibility, labor, and consumer laws.</li>
            <li>Use guest data only for lawful hospitality operations and in compliance with privacy obligations.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <SectionHeading id="guest-terms">7. Guest Terms</SectionHeading>
          <ul className="list-disc space-y-2 pl-6 text-sm leading-7 text-slate-700">
            <li>Guests must provide accurate booking and contact details.</li>
            <li>Reservation changes, cancellations, and no-show charges may be governed by restaurant policies.</li>
            <li>Restaurant-specific terms may apply and are communicated by the restaurant.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <SectionHeading id="ip">8. Intellectual Property</SectionHeading>
          <p className="text-sm leading-7 text-slate-700">
            ReserveSit and its underlying software, branding, and documentation are owned by ReserveSit, LLC and its
            licensors. Restaurants retain ownership of their own data and content uploaded to the platform.
          </p>
        </section>

        <section className="space-y-3">
          <SectionHeading id="privacy">9. Data and Privacy</SectionHeading>
          <p className="text-sm leading-7 text-slate-700">
            Our collection and processing of personal information is described in our <Link href="/privacy" className="text-blue-700 underline">Privacy Policy</Link>, which is incorporated into these Terms by reference.
          </p>
        </section>

        <section className="space-y-3">
          <SectionHeading id="availability">10. Service Availability</SectionHeading>
          <p className="text-sm leading-7 text-slate-700">
            We target high availability but do not guarantee uninterrupted or error-free service. Planned maintenance,
            third-party outages, and force majeure events may affect service access.
          </p>
        </section>

        <section className="space-y-3">
          <SectionHeading id="liability">11. Limitation of Liability</SectionHeading>
          <p className="text-sm leading-7 text-slate-700">
            To the maximum extent permitted by law, ReserveSit is not liable for indirect, incidental, special,
            consequential, or punitive damages, or loss of profits, revenue, data, or goodwill arising from use of the
            service. Our aggregate liability is limited to amounts paid by you to ReserveSit in the twelve months
            before the claim.
          </p>
        </section>

        <section className="space-y-3">
          <SectionHeading id="indemnification">12. Indemnification</SectionHeading>
          <p className="text-sm leading-7 text-slate-700">
            You agree to defend, indemnify, and hold harmless ReserveSit, LLC and its affiliates, officers, employees,
            and agents from claims, liabilities, damages, losses, and expenses arising out of your use of the service,
            your content, or your violation of these Terms or applicable law.
          </p>
        </section>

        <section className="space-y-3">
          <SectionHeading id="termination">13. Termination</SectionHeading>
          <p className="text-sm leading-7 text-slate-700">
            Either party may terminate the service in accordance with the applicable subscription terms. Upon
            termination, access may be suspended or revoked. We provide a 30-day window for data export unless legal or
            security obligations require immediate restriction.
          </p>
        </section>

        <section className="space-y-3">
          <SectionHeading id="disputes">14. Dispute Resolution</SectionHeading>
          <p className="text-sm leading-7 text-slate-700">
            These Terms are governed by the laws of the State of New York, without regard to conflict of law
            principles. Disputes will be resolved through binding arbitration in New York, except where injunctive or
            equitable relief is required to protect intellectual property or confidential information.
          </p>
        </section>

        <section className="space-y-3">
          <SectionHeading id="changes">15. Changes to Terms</SectionHeading>
          <p className="text-sm leading-7 text-slate-700">
            We may update these Terms from time to time. For material changes, we will provide at least 30 days'
            notice through email or an in-app notice. Continued use of the service after the effective date constitutes
            acceptance of the updated Terms.
          </p>
        </section>

        <section className="space-y-3">
          <SectionHeading id="contact">16. Contact</SectionHeading>
          <p className="text-sm leading-7 text-slate-700">
            ReserveSit, LLC
            <br />
            Website: <a href="https://reservesit.com" className="text-blue-700 underline">https://reservesit.com</a>
            <br />
            Email: <a href="mailto:support@reservesit.com" className="text-blue-700 underline">support@reservesit.com</a>
          </p>
        </section>
      </article>

      <p className="mt-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-900">
        This document is provided for informational purposes. We recommend consulting with a legal professional for
        your specific situation.
      </p>
    </div>
  );
}
