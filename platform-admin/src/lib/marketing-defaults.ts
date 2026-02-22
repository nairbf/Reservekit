export const DEFAULT_FAQ_ITEMS: Array<{ q: string; a: string }> = [
  {
    q: "How is ReserveSit different from OpenTable or Resy?",
    a: "ReserveSit is a one-time license you own outright. OpenTable and Resy charge $3,000-$3,600+ per year on entry-level plans, plus per-cover fees. ReserveSit starts at $2,199 once - no monthly fees, no per-cover charges.",
  },
  {
    q: "What's included in the first year of managed hosting?",
    a: "Your first year includes a dedicated cloud server, daily automated backups, software updates and security patches, uptime monitoring, SSL certificates, and email and chat support. Everything is handled for you.",
  },
  {
    q: "What happens after the first year of hosting?",
    a: "Starting year 2, managed hosting renews annually at $299-$399/yr depending on your plan. If you choose not to renew, your instance stays live but won't receive updates, backups, or support. You can also self-host at any time.",
  },
  {
    q: "Can I self-host ReserveSit on my own server?",
    a: "Yes. The software license is yours to keep. You can run it on any VPS or cloud provider. We provide documentation and setup guidance for self-hosted deployments.",
  },
  {
    q: "Can I try ReserveSit before buying?",
    a: "Yes. Our live demo at demo.reservesit.com is fully functional with real sample data and resets nightly. No sign-up required - just open it and explore.",
  },
  {
    q: "How quickly is my instance ready after purchase?",
    a: "Your hosted instance is provisioned automatically within minutes of purchase. You'll receive a welcome email with your login credentials and a link to complete your setup wizard.",
  },
  {
    q: "What POS systems does ReserveSit integrate with?",
    a: "ReserveSit integrates with SpotOn, Square, Toast, and Clover out of the box. Integrations sync menu items, tables, and business hours automatically.",
  },
  {
    q: "Can I upgrade my plan later?",
    a: "Yes. You can upgrade from Core to Service Pro or Full Suite at any time and only pay the difference in the one-time license cost.",
  },
  {
    q: "Does ReserveSit support SMS notifications?",
    a: "Yes. SMS notifications are included in Service Pro and Full Suite plans, and available as an add-on for Core. Guests receive automated booking confirmations and reminders by text.",
  },
  {
    q: "Can guests book reservations from my website?",
    a: "Yes. ReserveSit includes an embeddable booking widget you can add to any website. Guests can book, modify, or cancel reservations 24/7 without calling the restaurant.",
  },
  {
    q: "Is there a per-cover or per-reservation fee?",
    a: "No. ReserveSit has zero per-cover and zero per-reservation fees. You pay once for the license and a flat annual hosting fee starting year 2. That's it.",
  },
  {
    q: "What kind of support is included?",
    a: "All plans include email and chat support during onboarding and setup. Managed hosting plans include ongoing technical support. Service Pro and Full Suite plans receive priority support.",
  },
  {
    q: "Can I use my own domain name?",
    a: "Yes. Custom domain setup is available as a $30 one-time add-on. We handle the DNS configuration and SSL certificate so your booking page lives on your own domain.",
  },
  {
    q: "Does ReserveSit handle deposits and payments?",
    a: "Yes. ReserveSit supports deposit collection via Stripe at the time of booking. You can set deposit amounts per party size or require deposits for specific time slots.",
  },
  {
    q: "Is my data private and secure?",
    a: "Yes. Each restaurant runs on its own isolated database and server instance. Your guest data is never shared with other restaurants or third parties.",
  },
];

export const DEFAULT_MARKETING_SETTINGS: Record<string, string> = {
  hero_badge: "🚀 Now in production - restaurants are live",
  hero_headline: "The reservation platform you buy once and own.",
  hero_subheadline:
    "OpenTable and similar platforms start at $3,000-$3,600/year on their lowest plans - and go up from there. ReserveSit starts at a one-time $2,199 license.",
  hero_cta_primary_text: "See Pricing",
  hero_cta_primary_url: "/pricing",
  hero_cta_secondary_text: "Book a Demo Call",
  hero_cta_secondary_url: "/demo",
  hero_image: "/dashboard-mockup.png",
  features_headline: "Features Built for Real Service",
  features_subheadline: "Everything your team needs to run reservations without subscription lock-in.",
  integrations_list: "📍 SpotOn, 🟩 Square, 🍞 Toast, 🍀 Clover, 💳 Stripe",
  demo_section_headline: "👀 See it in action",
  demo_section_body: "Explore a fully working demo instance with real data. No sign-up required.",
  about_headline: "Built by operators, for operators.",
  about_body:
    "ReserveSit was created to give independent restaurants the same technology as the big chains - without the recurring fees.",
  demo_page_headline: "Try ReserveSit right now",
  demo_page_body: "Our demo instance has real data and resets nightly. No sign-up required.",
  faq_items: JSON.stringify(DEFAULT_FAQ_ITEMS),
};
