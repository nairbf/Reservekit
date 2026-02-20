"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AccessDenied from "@/components/access-denied";
import { useHasPermission } from "@/hooks/use-permissions";

interface Guest {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  vipStatus: string | null;
  totalVisits: number;
  totalNoShows: number;
  totalCovers: number;
  lastVisitDate: string | null;
  tags: string | null;
  dietaryNotes: string | null;
  allergyNotes: string | null;
}

type GuestFilter = "all" | "vip" | "new" | "returning" | "noshow" | "allergies";
type GuestSort = "visits_desc" | "visits_asc" | "last_visit_desc" | "last_visit_asc" | "name_asc" | "name_desc" | "noshow_desc" | "covers_desc";

const FILTERS: Array<{ key: GuestFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "vip", label: "VIP" },
  { key: "new", label: "New" },
  { key: "returning", label: "Returning" },
  { key: "noshow", label: "No-Show History" },
  { key: "allergies", label: "Allergies" },
];

const SORTS: Array<{ key: GuestSort; label: string }> = [
  { key: "visits_desc", label: "Most Visits" },
  { key: "visits_asc", label: "Least Visits" },
  { key: "last_visit_desc", label: "Recent Visit" },
  { key: "name_asc", label: "Name A-Z" },
  { key: "name_desc", label: "Name Z-A" },
  { key: "noshow_desc", label: "Most No-Shows" },
  { key: "covers_desc", label: "Most Covers" },
];

function visitSuffix(value: number): string {
  const v = value % 100;
  if (v >= 11 && v <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
}

function styleForGuest(guest: Guest) {
  if (guest.vipStatus === "blacklist") return { card: "border-red-300 bg-red-50", badge: "Blacklist", badgeClass: "bg-red-100 text-red-700" };
  if (guest.vipStatus === "vip") return { card: "border-amber-300 bg-amber-50", badge: "VIP", badgeClass: "bg-amber-100 text-amber-800" };
  if (guest.totalVisits >= 10) return { card: "border-purple-300 bg-purple-50", badge: "VIP", badgeClass: "bg-purple-100 text-purple-700" };
  if (guest.totalVisits >= 6) return { card: "border-amber-300 bg-amber-50", badge: "Regular", badgeClass: "bg-amber-100 text-amber-800" };
  if (guest.totalVisits >= 2) return { card: "border-blue-300 bg-blue-50", badge: "Returning", badgeClass: "bg-blue-100 text-blue-700" };
  return { card: "border-slate-200 bg-white", badge: "New", badgeClass: "bg-slate-100 text-slate-700" };
}

function toCsvRow(values: Array<string | number | null>): string {
  return values
    .map(value => {
      const raw = value == null ? "" : String(value);
      const escaped = raw.replace(/"/g, "\"\"");
      return `"${escaped}"`;
    })
    .join(",");
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "N/A";
  const parsed = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateString;
  return parsed.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function parseTags(tags: string | null): string[] {
  if (!tags) return [];
  return tags
    .split(",")
    .map(tag => tag.trim())
    .filter(Boolean);
}

export default function GuestsPage() {
  const canViewGuests = useHasPermission("view_guests");
  const [licenseOk, setLicenseOk] = useState<boolean | null>(null);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [filter, setFilter] = useState<GuestFilter>("all");
  const [sort, setSort] = useState<GuestSort>("visits_desc");
  const [tagFilter, setTagFilter] = useState("");
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);

  if (!canViewGuests) return <AccessDenied />;

  useEffect(() => {
    fetch("/api/settings/public")
      .then(r => r.json())
      .then((s) => setLicenseOk(s.feature_guest_history === "true"))
      .catch(() => setLicenseOk(false));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (licenseOk !== true) return;
    setLoading(true);
    const query = new URLSearchParams();
    if (debounced) query.set("search", debounced);
    query.set("filter", filter);
    query.set("sort", sort);
    if (tagFilter) query.set("tag", tagFilter);
    fetch(`/api/guests?${query.toString()}`)
      .then(r => r.json())
      .then(data => setGuests(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [debounced, filter, sort, tagFilter, licenseOk]);

  const total = guests.length;

  const allVisibleTags = useMemo(() => {
    const tags = new Set<string>();
    for (const guest of guests) {
      for (const tag of parseTags(guest.tags)) tags.add(tag);
    }
    return [...tags].slice(0, 12);
  }, [guests]);

  function exportCsv() {
    const header = toCsvRow(["Name", "Phone", "Email", "VIP Status", "Visits", "No-Shows", "Total Covers", "Last Visit", "Tags"]);
    const rows = guests.map(guest =>
      toCsvRow([
        guest.name,
        guest.phone,
        guest.email,
        guest.vipStatus || "regular",
        guest.totalVisits,
        guest.totalNoShows,
        guest.totalCovers,
        guest.lastVisitDate,
        guest.tags || "",
      ])
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "guest-list.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (licenseOk === null) {
    return (
      <div className="flex items-center gap-3 text-slate-500">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        Checking license...
      </div>
    );
  }

  if (licenseOk === false) {
    return (
      <div className="max-w-3xl">
        <h1 className="mb-4 text-2xl font-bold">Guest History</h1>
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-slate-600">Feature not available for your current plan. Contact support to enable Guest History.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Guests</h1>
          <p className="text-sm text-slate-500">Relationship and visit history.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search by name, phone, or email"
            className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm sm:w-80"
          />
          <button
            onClick={exportCsv}
            className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50 sm:w-auto"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="inline-flex min-w-full gap-2">
          {FILTERS.map(item => (
            <button
              key={item.key}
              onClick={() => setFilter(item.key)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-all ${
                filter === item.key
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="text-sm text-slate-600">Showing {total} guests</div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <label className="text-sm text-slate-600">
            Sort by
            <select
              value={sort}
              onChange={event => setSort(event.target.value as GuestSort)}
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm sm:ml-2 sm:mt-0 sm:w-52"
            >
              {SORTS.map(option => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
          </label>
          {tagFilter ? (
            <button
              onClick={() => setTagFilter("")}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700 sm:w-auto"
            >
              Clear tag: {tagFilter}
            </button>
          ) : null}
        </div>
      </div>

      {allVisibleTags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {allVisibleTags.map(tag => (
            <button
              key={tag}
              onClick={() => setTagFilter(tag)}
              className={`rounded-full px-2.5 py-1 text-xs transition-all ${
                tagFilter === tag
                  ? "bg-blue-100 text-blue-700"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-3 text-slate-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          Loading guests...
        </div>
      ) : guests.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">No guests found.</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
          {guests.map(guest => {
            const style = styleForGuest(guest);
            const tags = parseTags(guest.tags);
            return (
              <Link
                key={guest.id}
                href={`/dashboard/guests/${guest.id}`}
                className={`block rounded-xl border p-3 shadow-sm transition-all hover:shadow sm:p-5 ${style.card}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-lg font-bold">{guest.name}</div>
                    <div className="text-sm text-slate-600">{guest.phone}</div>
                    {guest.email ? <div className="truncate text-xs text-slate-500">{guest.email}</div> : null}
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${style.badgeClass}`}>{style.badge}</span>
                </div>

                <div className="mt-3 text-sm font-semibold text-slate-800">
                  Last visit: {formatDate(guest.lastVisitDate)}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                  <span>{guest.totalVisits} visit{guest.totalVisits === 1 ? "" : "s"}</span>
                  {guest.totalVisits > 1 ? <span className="text-blue-700">↩ {visitSuffix(guest.totalVisits)} visit</span> : null}
                  <span>•</span>
                  <span>{guest.totalCovers} covers</span>
                  {guest.totalNoShows > 0 ? <span className="text-rose-700">• {guest.totalNoShows} no-shows</span> : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {guest.allergyNotes ? <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700">🥜 Allergies</span> : null}
                  {guest.dietaryNotes ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">🌿 Dietary</span> : null}
                  {tags.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        setTagFilter(tag);
                      }}
                      className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
