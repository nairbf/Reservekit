export const DEFAULT_FAQ_ITEMS: Array<{ q: string; a: string }> = [
  {
    q: "How is ReserveSit different from OpenTable?",
    a: "ReserveSit is a one-time license you own. No per-cover fees or monthly lock-in.",
  },
  {
    q: "Can I try ReserveSit before buying?",
    a: "Yes. The live demo at demo.reservesit.com is fully functional and resets nightly.",
  },
  {
    q: "What happens after purchase?",
    a: "Your hosted instance is provisioned and you receive onboarding details to go live quickly.",
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
