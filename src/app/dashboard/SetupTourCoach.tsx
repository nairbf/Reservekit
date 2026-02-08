"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type TourKey = "inbox" | "tonight" | "tables" | "floorplan" | "settings" | "publish";

const TOUR_TIPS: Record<TourKey, { title: string; body: string; checklist: string[] }> = {
  inbox: {
    title: "Inbox Quick Start",
    body: "Approve, decline, or counter pending requests. Start by opening one card and assigning a table before approving.",
    checklist: [
      "Review guest name, date/time, and party size",
      "Assign a table before approving when possible",
      "Use counter-offer if you need a better seating time",
    ],
  },
  tonight: {
    title: "Tonight Service Flow",
    body: "Use Tonight as your live board during service. The normal sequence is Arrive, Seat, then Complete.",
    checklist: [
      "Click Arrive when guest checks in",
      "Click Seat once they are at the table",
      "Click Complete when service ends",
    ],
  },
  tables: {
    title: "Table Setup",
    body: "Confirm names and capacities first. This drives assignment suggestions throughout the app.",
    checklist: [
      "Verify each table name is unique",
      "Set realistic min and max capacities",
      "Remove any tables that are not in service",
    ],
  },
  floorplan: {
    title: "Floor Plan Basics",
    body: "Switch to Edit mode to place tables, then save layout. Use Live mode during service for status at a glance.",
    checklist: [
      "Open Edit mode and position tables",
      "Save layout after moving tables",
      "Switch back to Live mode for service",
    ],
  },
  settings: {
    title: "Settings Checklist",
    body: "Finalize operational defaults and communication settings so reservations behave consistently.",
    checklist: [
      "Confirm open/close times and interval",
      "Set max covers and max party size",
      "Configure SMTP to send guest emails",
    ],
  },
  publish: {
    title: "Publish Reservation Widget",
    body: "Copy the embed script from Settings and place it on your website. Then submit one test reservation.",
    checklist: [
      "Copy widget embed code from Settings",
      "Paste script into your website",
      "Submit a real test request end-to-end",
    ],
  },
};

export default function SetupTourCoach() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const fromSetup = searchParams.get("fromSetup") === "1";
  const rawTour = searchParams.get("tour");
  const tourKey = (rawTour && rawTour in TOUR_TIPS ? rawTour : null) as TourKey | null;
  if (!fromSetup || !tourKey) return null;

  const tip = TOUR_TIPS[tourKey];

  function dismissTip() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("tour");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div className="fixed bottom-4 right-4 z-[60] w-[min(92vw,420px)] rounded-xl border border-blue-200 bg-white shadow-2xl">
      <div className="flex items-start justify-between gap-3 p-4 border-b border-blue-100 bg-blue-50 rounded-t-xl">
        <div>
          <h3 className="font-semibold text-blue-900">{tip.title}</h3>
          <p className="text-xs text-blue-700 mt-1">{tip.body}</p>
        </div>
        <button onClick={dismissTip} className="h-8 w-8 rounded-md border border-blue-200 text-blue-700 text-sm">✕</button>
      </div>
      <div className="p-4">
        <ul className="space-y-2 text-sm text-gray-700">
          {tip.checklist.map(item => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-1 h-2 w-2 rounded-full bg-blue-500" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex gap-2">
          <button onClick={dismissTip} className="h-10 px-3 rounded-lg border border-gray-200 text-sm transition-all duration-200">Dismiss</button>
          <Link href="/dashboard/setup" className="h-10 px-3 rounded-lg bg-blue-600 text-white text-sm flex items-center transition-all duration-200">
            Back to Setup Wizard
          </Link>
        </div>
      </div>
    </div>
  );
}
