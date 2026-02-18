import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | ReserveSit",
  description: "ReserveSit Privacy Policy",
};

const sections = [
  { id: "introduction", title: "1. Introduction" },
  { id: "information-we-collect", title: "2. Information We Collect" },
  { id: "how-we-use", title: "3. How We Use Your Information" },
  { id: "how-we-share", title: "4. How We Share Your Information" },
  { id: "retention", title: "5. Data Retention" },
  { id: "your-rights", title: "6. Your Rights" },
  { id: "cookies", title: "7. Cookies" },
  { id: "security", title: "8. Security" },
  { id: "children", title: "9. Children's Privacy" },
  { id: "changes", title: "10. Changes to This Policy" },
  { id: "contact", title: "11. Contact Us" },
];

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 text-2xl font-semibold text-slate-900">
      {children}
    </h2>
  );
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
      <Link href="/" className="text-sm font-medium text-blue-700 hover:text-blue-800">
        ← Back to Home
      </Link>

      <header className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Legal</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">Privacy Policy</h1>
        <p className="mt-3 text-sm text-slate-600">
          Last updated: February 2026
          <br />
          This Privacy Policy describes how ReserveSit, LLC ("ReserveSit," "we," "our," or "us") collects, uses,
          and discloses information when you use <a className="text-blue-700 underline" href="https://reservesit.com">reservesit.com</a> and related services.
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
          <SectionHeading id="introduction">1. Introduction</SectionHeading>
          <p className="text-sm leading-7 text-slate-700">
            ReserveSit provides reservation and restaurant management software to restaurants and hospitality groups.
            This policy applies to information we collect from restaurant owners and staff using our platform, and from
            guests who submit reservations or waitlist requests through a restaurant using ReserveSit.
          </p>
        </section>

        <section className="space-y-3">
          <SectionHeading id="information-we-collect">2. Information We Collect</SectionHeading>
          <div className="space-y-4 text-sm leading-7 text-slate-700">
            <div>
              <h3 className="font-semibold text-slate-900">Restaurant owners and staff</h3>
              <p>
                We collect account and business information such as name, email, phone number, restaurant details,
                subdomain configuration, and billing records. Payment card processing is handled by Stripe and we do not
                store full card numbers in our systems.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Restaurant guests (diners)</h3>
              <p>
                We collect data submitted during booking, including name, email, phone number, party size, reservation
                date/time, special requests, dietary preferences, and waitlist details.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Automatically collected data</h3>
              <p>
                We may collect IP address, browser/device details, approximate location, page activity, and session
                data through logs and cookies necessary to run and secure the service.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <SectionHeading id="how-we-use">3. How We Use Your Information</SectionHeading>
          <ul className="list-disc space-y-2 pl-6 text-sm leading-7 text-slate-700">
            <li>Provide, maintain, and support the ReserveSit platform.</li>
            <li>Process reservations and waitlist workflows for restaurant customers.</li>
            <li>Send transactional notifications such as confirmations, reminders, status updates, and password resets.</li>
            <li>Communicate account updates, service changes, and support messages.</li>
            <li>Monitor performance and improve product reliability and usability.</li>
            <li>Detect abuse, prevent fraud, and comply with legal obligations.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <SectionHeading id="how-we-share">4. How We Share Your Information</SectionHeading>
          <div className="space-y-3 text-sm leading-7 text-slate-700">
            <p>
              We share guest information with the restaurant where the reservation is made so the restaurant can provide
              service.
            </p>
            <p>
              We share limited data with service providers that help us operate the platform, including Resend
              (transactional email), Stripe (payment processing), and Cloudflare (DNS/CDN/security).
            </p>
            <p>
              We may disclose information when required by law, subpoena, court order, or to protect the rights,
              safety, and security of ReserveSit, restaurants, or guests.
            </p>
            <p className="font-semibold text-slate-900">We do not sell personal data.</p>
          </div>
        </section>

        <section className="space-y-3">
          <SectionHeading id="retention">5. Data Retention</SectionHeading>
          <p className="text-sm leading-7 text-slate-700">
            We retain data for as long as needed to provide the service, meet contractual requirements, resolve
            disputes, and comply with legal obligations. Restaurants may request deletion of their account data, and we
            provide a reasonable period for export before deletion. Guest data retained by a restaurant is also subject
            to that restaurant's policies and legal obligations.
          </p>
        </section>

        <section className="space-y-3">
          <SectionHeading id="your-rights">6. Your Rights</SectionHeading>
          <p className="text-sm leading-7 text-slate-700">
            Depending on your location, you may have rights to request access, correction, or deletion of personal
            information, and to opt out of non-essential marketing communications. To exercise these rights, contact us
            at support@reservesit.com.
          </p>
        </section>

        <section className="space-y-3">
          <SectionHeading id="cookies">7. Cookies</SectionHeading>
          <p className="text-sm leading-7 text-slate-700">
            We use limited cookies and similar technologies for session authentication, security, and user preferences.
            We may also use analytics tools to understand platform usage and improve performance.
          </p>
        </section>

        <section className="space-y-3">
          <SectionHeading id="security">8. Security</SectionHeading>
          <p className="text-sm leading-7 text-slate-700">
            We use technical and organizational safeguards designed to protect personal information, including encrypted
            transport, role-based access controls, and secured US-based hosting infrastructure. No system is perfectly
            secure, but we continuously work to protect data and reduce risk.
          </p>
        </section>

        <section className="space-y-3">
          <SectionHeading id="children">9. Children's Privacy</SectionHeading>
          <p className="text-sm leading-7 text-slate-700">
            ReserveSit is not directed to children under 13, and we do not knowingly collect personal information from
            children under 13. If you believe a child has provided information through our services, contact us and we
            will investigate and take appropriate action.
          </p>
        </section>

        <section className="space-y-3">
          <SectionHeading id="changes">10. Changes to This Policy</SectionHeading>
          <p className="text-sm leading-7 text-slate-700">
            We may update this Privacy Policy from time to time. If we make material changes, we will post the updated
            policy on this page and update the "Last updated" date. Continued use of the services after an update means
            the updated policy applies.
          </p>
        </section>

        <section className="space-y-3">
          <SectionHeading id="contact">11. Contact Us</SectionHeading>
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
