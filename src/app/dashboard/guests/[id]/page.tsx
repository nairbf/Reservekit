"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

interface GuestReservation {
  id: number;
  date: string;
  time: string;
  partySize: number;
  status: string;
  table: { id: number; name: string } | null;
}

interface GuestDetail {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  vipStatus: string | null;
  dietaryNotes: string | null;
  allergyNotes: string | null;
  generalNotes: string | null;
  tags: string | null;
  totalVisits: number;
  totalNoShows: number;
  totalCovers: number;
  firstVisitDate: string | null;
  lastVisitDate: string | null;
  reservations: GuestReservation[];
}

function formatTime12(value: string): string {
  const match = (value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return value;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return value;
  const h = hour % 12 || 12;
  return `${h}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

export default function GuestDetailPage() {
  const params = useParams<{ id: string }>();
  const guestId = Number(params.id);

  const [licenseOk, setLicenseOk] = useState<boolean | null>(null);
  const [guest, setGuest] = useState<GuestDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then(r => r.json()),
      fetch("/api/auth/me").then(r => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([s, session]) => {
        const key = String(s.license_guesthistory || "").toUpperCase();
        const hasKey = /^RS-GST-[A-Z0-9]{8}$/.test(key);
        const isAdmin = session?.role === "admin";
        setLicenseOk(hasKey || isAdmin);
      })
      .catch(() => setLicenseOk(false));
  }, []);

  useEffect(() => {
    if (licenseOk !== true || !guestId) return;
    setLoading(true);
    fetch(`/api/guests/${guestId}`)
      .then(r => r.json())
      .then(data => setGuest(data))
      .finally(() => setLoading(false));
  }, [guestId, licenseOk]);

  function setField<K extends keyof GuestDetail>(key: K, value: GuestDetail[K]) {
    setGuest(prev => (prev ? { ...prev, [key]: value } : prev));
  }

  async function saveProfile() {
    if (!guest) return;
    setSaving(true);
    await fetch(`/api/guests/${guest.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: guest.name,
        email: guest.email,
        vipStatus: guest.vipStatus,
        dietaryNotes: guest.dietaryNotes,
        allergyNotes: guest.allergyNotes,
        generalNotes: guest.generalNotes,
        tags: guest.tags,
      }),
    });
    setSaving(false);
  }

  async function addNote() {
    const note = noteText.trim();
    if (!note || !guest) return;
    await fetch(`/api/guests/${guest.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    setNoteText("");
    const refreshed = await fetch(`/api/guests/${guest.id}`).then(r => r.json());
    setGuest(refreshed);
  }

  if (licenseOk === null) {
    return (
      <div className="flex items-center gap-3 text-gray-500">
        <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
        Checking license...
      </div>
    );
  }

  if (licenseOk === false) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold mb-4">Guest History</h1>
        <div className="bg-white rounded-xl shadow p-6">
          <p className="text-gray-600 mb-4">Guest History is a paid add-on.</p>
          <Link href="/#pricing" className="inline-flex items-center h-11 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium transition-all duration-200">Upgrade to Unlock</Link>
        </div>
      </div>
    );
  }

  if (loading || !guest) {
    return (
      <div className="flex items-center gap-3 text-gray-500">
        <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
        Loading guest profile...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold">{guest.name}</h1>
            <p className="text-sm text-gray-600">{guest.phone}</p>
          </div>
          <button
            onClick={saveProfile}
            className="h-11 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium transition-all duration-200"
          >
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <label className="text-sm font-medium">Email
            <input
              value={guest.email || ""}
              onChange={e => setField("email", e.target.value || null)}
              className="mt-1 h-11 w-full border rounded px-3"
            />
          </label>
          <label className="text-sm font-medium">VIP Status
            <select
              value={guest.vipStatus || "regular"}
              onChange={e => setField("vipStatus", e.target.value)}
              className="mt-1 h-11 w-full border rounded px-3"
            >
              <option value="regular">regular</option>
              <option value="vip">vip</option>
              <option value="blacklist">blacklist</option>
            </select>
          </label>
          <label className="text-sm font-medium">Tags
            <input
              value={guest.tags || ""}
              onChange={e => setField("tags", e.target.value || null)}
              placeholder="birthday regular, window seat"
              className="mt-1 h-11 w-full border rounded px-3"
            />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl shadow p-4"><div className="text-2xl font-bold">{guest.totalVisits}</div><div className="text-xs text-gray-500">Visits</div></div>
        <div className="bg-white rounded-xl shadow p-4"><div className="text-2xl font-bold">{guest.totalCovers}</div><div className="text-xs text-gray-500">Total covers</div></div>
        <div className="bg-white rounded-xl shadow p-4"><div className="text-2xl font-bold">{guest.totalNoShows}</div><div className="text-xs text-gray-500">No-shows</div></div>
        <div className="bg-white rounded-xl shadow p-4"><div className="text-sm font-bold">{guest.firstVisitDate || "N/A"}</div><div className="text-xs text-gray-500">First visit</div></div>
        <div className="bg-white rounded-xl shadow p-4"><div className="text-sm font-bold">{guest.lastVisitDate || "N/A"}</div><div className="text-xs text-gray-500">Last visit</div></div>
      </div>

      <div className="bg-white rounded-xl shadow p-4 sm:p-6 space-y-4">
        <h2 className="text-lg font-bold">Notes</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="text-sm font-medium">Dietary Notes
            <textarea
              value={guest.dietaryNotes || ""}
              onChange={e => setField("dietaryNotes", e.target.value || null)}
              rows={3}
              className="mt-1 w-full border rounded px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium">Allergy Notes
            <textarea
              value={guest.allergyNotes || ""}
              onChange={e => setField("allergyNotes", e.target.value || null)}
              rows={3}
              className="mt-1 w-full border border-red-300 bg-red-50 rounded px-3 py-2"
            />
          </label>
        </div>
        <label className="text-sm font-medium block">General Notes
          <textarea
            value={guest.generalNotes || ""}
            onChange={e => setField("generalNotes", e.target.value || null)}
            rows={6}
            className="mt-1 w-full border rounded px-3 py-2"
          />
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="Add timestamped staff note"
            className="h-11 flex-1 border rounded px-3"
          />
          <button onClick={addNote} className="h-11 px-4 rounded-lg bg-gray-900 text-white text-sm font-medium transition-all duration-200">Add Note</button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4 sm:p-6">
        <h2 className="text-lg font-bold mb-3">Reservation History</h2>
        <div className="max-h-96 overflow-auto border rounded-lg">
          {guest.reservations.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">No reservations yet.</div>
          ) : (
            <div className="divide-y">
              {guest.reservations.map(r => (
                <div key={r.id} className="p-3 text-sm flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{r.date} at {formatTime12(r.time)}</div>
                    <div className="text-gray-500">Party {r.partySize} · {r.status.replace("_", " ")}</div>
                  </div>
                  <div className="text-xs text-gray-500">{r.table?.name || "No table"}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
