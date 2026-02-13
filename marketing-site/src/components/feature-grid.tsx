import {
  CalendarCheck2,
  LayoutDashboard,
  Mail,
  PhoneCall,
  Ticket,
  ShieldCheck,
  Map,
  Users,
  ChartColumn,
} from "lucide-react";

const features = [
  { icon: CalendarCheck2, title: "Guest Booking Widget", desc: "Embed on your website. Guests pick date, time, and party size." },
  { icon: LayoutDashboard, title: "Hostess Dashboard", desc: "Tablet-friendly workflows for requests, arrivals, and tables." },
  { icon: Mail, title: "Email Notifications", desc: "Automatic confirmations, reminders, and status updates." },
  { icon: PhoneCall, title: "Walk-ins & Phone", desc: "Capture in-person and call-in demand in seconds." },
  { icon: Ticket, title: "Event Ticketing", desc: "Run wine dinners, holiday seatings, and paid special events." },
  { icon: ShieldCheck, title: "Smart Availability", desc: "Capacity rules prevent overbooking during peak periods." },
  { icon: Map, title: "Visual Floor Plan", desc: "Drag-and-drop layout with live table state. (Add-on)" },
  { icon: Users, title: "Guest History", desc: "Repeat-guest timeline, notes, and loyalty context. (Add-on)" },
  { icon: ChartColumn, title: "Reporting Dashboard", desc: "Covers, no-show trends, and service performance. (Add-on)" },
];

export function FeatureGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {features.map((feature) => {
        const Icon = feature.icon;
        return (
          <div key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <Icon className="h-6 w-6 text-blue-600" />
            <h3 className="mt-3 text-base font-semibold text-slate-900">{feature.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{feature.desc}</p>
          </div>
        );
      })}
    </div>
  );
}
