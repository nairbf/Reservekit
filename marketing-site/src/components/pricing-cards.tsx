const plans = [
  {
    name: "Core",
    price: "$2,199",
    hosting: "+ $299/yr managed hosting (1st year free)",
    href: "/pricing",
    features: [
      "Reservation widget + host dashboard",
      "Waitlist and schedule management",
      "Landing page builder",
      "POS integrations included",
      "First year managed hosting included",
    ],
  },
  {
    name: "Service Pro",
    price: "$2,999",
    hosting: "+ $399/yr managed hosting (1st year free)",
    href: "/pricing",
    featured: true,
    features: [
      "Everything in Core",
      "SMS notifications",
      "Interactive floor plan",
      "Reporting dashboard",
      "Priority setup support",
    ],
  },
  {
    name: "Full Suite",
    price: "$3,799",
    hosting: "+ $399/yr managed hosting (1st year free)",
    href: "/pricing",
    features: [
      "Everything in Service Pro",
      "Event ticketing",
      "Full guest history & loyalty",
      "Pre-ordering",
      "Advanced customization",
    ],
  },
];

const addOns = [
  { name: "SMS Notifications", price: "$349" },
  { name: "Visual Floor Plan", price: "$399" },
  { name: "Reporting Dashboard", price: "$299" },
  { name: "Guest History & Loyalty", price: "$349" },
  { name: "Event Ticketing", price: "$299" },
  { name: "Custom Domain Setup", price: "$30" },
];

export function PricingCards() {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-2xl border p-6 ${plan.featured ? "border-blue-500 bg-blue-50/70 shadow-md" : "border-slate-200 bg-white shadow-sm"}`}
          >
            <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
            <p className="mt-2 text-3xl font-bold text-slate-900">{plan.price}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">One-time license</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">{plan.hosting}</p>

            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              {plan.features.map((feature) => (
                <li key={feature}>• {feature}</li>
              ))}
            </ul>

            <a
              href={plan.href}
              className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition-all duration-200 hover:bg-slate-700"
            >
              Configure Plan
            </a>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h4 className="text-lg font-semibold text-slate-900">Add-on Builder</h4>
        <p className="mt-1 text-sm text-slate-600">Core customers can add individual features one-time as needed.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {addOns.map((item) => (
            <div key={item.name} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-medium text-slate-900">{item.name}</p>
              <p className="text-sm text-blue-700">{item.price}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-slate-700">
          Annual managed hosting starts in year 2. First year is included with every plan.
        </p>
      </div>
    </div>
  );
}
