const plans = [
  {
    name: "Core",
    price: "$1,799",
    href: "https://buy.stripe.com/PLACEHOLDER_CORE",
    features: [
      "Booking widget",
      "Hostess dashboard",
      "Tables + approvals",
      "Email notifications",
      "Walk-ins + phone bookings",
    ],
  },
  {
    name: "Service Pro",
    price: "$2,227",
    href: "https://buy.stripe.com/PLACEHOLDER_PRO",
    featured: true,
    features: [
      "Everything in Core",
      "SMS notifications",
      "Visual floor plan",
      "Reporting dashboard",
      "Priority setup support",
    ],
  },
  {
    name: "Full Suite",
    price: "$2,734",
    href: "https://buy.stripe.com/PLACEHOLDER_FULL",
    features: [
      "Everything in Service Pro",
      "Guest history + notes",
      "Event ticketing",
      "Advanced customization",
      "Best for high-volume service",
    ],
  },
];

const addOns = [
  { name: "SMS Notifications", price: "$199" },
  { name: "Visual Floor Plan", price: "$249" },
  { name: "Reporting Dashboard", price: "$179" },
  { name: "Guest History", price: "$179" },
  { name: "Event Ticketing", price: "$129" },
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

            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              {plan.features.map((feature) => (
                <li key={feature}>• {feature}</li>
              ))}
            </ul>

            <a
              href={plan.href}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition-all duration-200 hover:bg-slate-700"
            >
              Buy Now
            </a>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h4 className="text-lg font-semibold text-slate-900">Add-on Builder</h4>
        <p className="mt-1 text-sm text-slate-600">Start with any plan and add exactly what you need.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {addOns.map((item) => (
            <div key={item.name} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-medium text-slate-900">{item.name}</p>
              <p className="text-sm text-blue-700">{item.price}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-slate-700">
          Managed hosting add-on: <strong>$15/month</strong> (monitoring, backups, and updates)
        </p>
      </div>
    </div>
  );
}
