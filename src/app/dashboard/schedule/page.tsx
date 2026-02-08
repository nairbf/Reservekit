"use client";
import { useState, useEffect } from "react";

interface Override { id: number; date: string; isClosed: boolean; openTime: string | null; closeTime: string | null; maxCovers: number | null; note: string | null }
interface RequestSettingsForm {
  depositsEnabled: boolean;
  depositAmount: string;
  depositMinParty: string;
  depositMessage: string;
  reserveHeading: string;
  reserveSubheading: string;
  reserveConfirmationMessage: string;
  reserveRequestDisclaimer: string;
  reserveRequestPlaceholder: string;
  reserveRequestSamples: string;
}

export default function SchedulePage() {
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [form, setForm] = useState({ date: "", isClosed: false, openTime: "", closeTime: "", maxCovers: "", note: "" });
  const [requestSettings, setRequestSettings] = useState<RequestSettingsForm>({
    depositsEnabled: false,
    depositAmount: "0",
    depositMinParty: "2",
    depositMessage: "A refundable deposit may be required to hold your table.",
    reserveHeading: "Reserve a Table",
    reserveSubheading: "Choose your date, time, and party size.",
    reserveConfirmationMessage: "We'll contact you shortly to confirm.",
    reserveRequestDisclaimer: "Your request will be reviewed and confirmed shortly.",
    reserveRequestPlaceholder: "e.g., Birthday dinner, window seat, stroller space",
    reserveRequestSamples: "Birthday celebration,Window seat,High chair",
  });
  const [loaded, setLoaded] = useState(false);
  const [savingRequestSettings, setSavingRequestSettings] = useState(false);
  const [requestSettingsSaved, setRequestSettingsSaved] = useState(false);

  useEffect(() => { load(); }, []);
  async function load() {
    const [overrideRes, settingsRes] = await Promise.all([fetch("/api/day-overrides"), fetch("/api/settings")]);
    const [overrideData, settings] = await Promise.all([overrideRes.json(), settingsRes.json()]);
    setOverrides(overrideData);
    setRequestSettings({
      depositsEnabled: settings.depositsEnabled === "true",
      depositAmount: settings.depositAmount || "0",
      depositMinParty: settings.depositMinParty || "2",
      depositMessage: settings.depositMessage || "A refundable deposit may be required to hold your table.",
      reserveHeading: settings.reserveHeading || "Reserve a Table",
      reserveSubheading: settings.reserveSubheading || "Choose your date, time, and party size.",
      reserveConfirmationMessage: settings.reserveConfirmationMessage || "We'll contact you shortly to confirm.",
      reserveRequestDisclaimer: settings.reserveRequestDisclaimer || "Your request will be reviewed and confirmed shortly.",
      reserveRequestPlaceholder: settings.reserveRequestPlaceholder || "e.g., Birthday dinner, window seat, stroller space",
      reserveRequestSamples: settings.reserveRequestSamples || "Birthday celebration,Window seat,High chair",
    });
    setLoaded(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/day-overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: form.date,
        isClosed: form.isClosed,
        openTime: form.openTime || null,
        closeTime: form.closeTime || null,
        maxCovers: form.maxCovers ? parseInt(form.maxCovers) : null,
        note: form.note || null,
      }),
    });
    setForm({ date: "", isClosed: false, openTime: "", closeTime: "", maxCovers: "", note: "" });
    load();
  }

  async function remove(id: number) { await fetch(`/api/day-overrides/${id}`, { method: "DELETE" }); load(); }
  async function saveRequestSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingRequestSettings(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        depositsEnabled: requestSettings.depositsEnabled,
        depositAmount: requestSettings.depositAmount,
        depositMinParty: requestSettings.depositMinParty,
        depositMessage: requestSettings.depositMessage,
        reserveHeading: requestSettings.reserveHeading,
        reserveSubheading: requestSettings.reserveSubheading,
        reserveConfirmationMessage: requestSettings.reserveConfirmationMessage,
        reserveRequestDisclaimer: requestSettings.reserveRequestDisclaimer,
        reserveRequestPlaceholder: requestSettings.reserveRequestPlaceholder,
        reserveRequestSamples: requestSettings.reserveRequestSamples,
      }),
    });
    setSavingRequestSettings(false);
    setRequestSettingsSaved(true);
    setTimeout(() => setRequestSettingsSaved(false), 2000);
  }

  const samplePreview = requestSettings.reserveRequestSamples.split(",").map(s => s.trim()).filter(Boolean);

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Schedule Overrides</h1>
        <p className="text-gray-500">Close dates, change hours for holidays, or adjust capacity for events.</p>
      </div>

      <form onSubmit={save} className="bg-white rounded-xl shadow p-4 sm:p-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="h-11 w-full border rounded px-3" required />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={form.isClosed} onChange={e => setForm({ ...form, isClosed: e.target.checked })} className="h-4 w-4" />
              Closed this day
            </label>
          </div>
        </div>

        {!form.isClosed && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Open</label>
              <input type="time" value={form.openTime} onChange={e => setForm({ ...form, openTime: e.target.value })} className="h-11 w-full border rounded px-3" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Close</label>
              <input type="time" value={form.closeTime} onChange={e => setForm({ ...form, closeTime: e.target.value })} className="h-11 w-full border rounded px-3" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max Covers</label>
              <input type="number" value={form.maxCovers} onChange={e => setForm({ ...form, maxCovers: e.target.value })} className="h-11 w-full border rounded px-3" placeholder="Default" />
            </div>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Note</label>
          <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} className="h-11 w-full border rounded px-3" placeholder="e.g., Private event, Holiday hours" />
        </div>

        <button type="submit" className="h-11 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium transition-all duration-200">Save Override</button>
      </form>

      <form onSubmit={saveRequestSettings} className="bg-white rounded-xl shadow p-4 sm:p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold">Reservation Request Controls</h2>
            <p className="text-sm text-gray-500">Customize deposit behavior and guest-facing request messaging.</p>
          </div>
          <button type="submit" className="h-11 px-4 rounded-lg bg-gray-900 text-white text-sm font-medium transition-all duration-200">
            {savingRequestSettings ? "Saving..." : requestSettingsSaved ? "Saved" : "Save Request Settings"}
          </button>
        </div>

        <div className="border rounded-lg p-4 mb-4">
          <label className="flex items-center gap-2 text-sm font-medium mb-3">
            <input
              type="checkbox"
              checked={requestSettings.depositsEnabled}
              onChange={e => setRequestSettings(s => ({ ...s, depositsEnabled: e.target.checked }))}
              className="h-4 w-4"
            />
            Require deposit for eligible reservation requests
          </label>
          {requestSettings.depositsEnabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="text-sm font-medium">Deposit Amount (USD)
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={requestSettings.depositAmount}
                  onChange={e => setRequestSettings(s => ({ ...s, depositAmount: e.target.value }))}
                  className="mt-1 h-11 w-full border rounded px-3"
                />
              </label>
              <label className="text-sm font-medium">Apply at Party Size
                <input
                  type="number"
                  min="1"
                  value={requestSettings.depositMinParty}
                  onChange={e => setRequestSettings(s => ({ ...s, depositMinParty: e.target.value }))}
                  className="mt-1 h-11 w-full border rounded px-3"
                />
              </label>
              <label className="text-sm font-medium sm:col-span-2">Deposit Message
                <textarea
                  value={requestSettings.depositMessage}
                  onChange={e => setRequestSettings(s => ({ ...s, depositMessage: e.target.value }))}
                  className="mt-1 w-full border rounded px-3 py-2"
                  rows={2}
                />
              </label>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <label className="text-sm font-medium">Reserve Heading
            <input
              value={requestSettings.reserveHeading}
              onChange={e => setRequestSettings(s => ({ ...s, reserveHeading: e.target.value }))}
              className="mt-1 h-11 w-full border rounded px-3"
            />
          </label>
          <label className="text-sm font-medium">Reserve Subheading
            <input
              value={requestSettings.reserveSubheading}
              onChange={e => setRequestSettings(s => ({ ...s, reserveSubheading: e.target.value }))}
              className="mt-1 h-11 w-full border rounded px-3"
            />
          </label>
          <label className="text-sm font-medium sm:col-span-2">Confirmation Message
            <input
              value={requestSettings.reserveConfirmationMessage}
              onChange={e => setRequestSettings(s => ({ ...s, reserveConfirmationMessage: e.target.value }))}
              className="mt-1 h-11 w-full border rounded px-3"
            />
          </label>
          <label className="text-sm font-medium sm:col-span-2">Request Form Helper Text
            <input
              value={requestSettings.reserveRequestDisclaimer}
              onChange={e => setRequestSettings(s => ({ ...s, reserveRequestDisclaimer: e.target.value }))}
              className="mt-1 h-11 w-full border rounded px-3"
            />
          </label>
          <label className="text-sm font-medium sm:col-span-2">Special Request Placeholder
            <input
              value={requestSettings.reserveRequestPlaceholder}
              onChange={e => setRequestSettings(s => ({ ...s, reserveRequestPlaceholder: e.target.value }))}
              className="mt-1 h-11 w-full border rounded px-3"
            />
          </label>
          <label className="text-sm font-medium sm:col-span-2">Special Request Quick Samples (comma-separated)
            <input
              value={requestSettings.reserveRequestSamples}
              onChange={e => setRequestSettings(s => ({ ...s, reserveRequestSamples: e.target.value }))}
              className="mt-1 h-11 w-full border rounded px-3"
              placeholder="Birthday celebration,Window seat,High chair"
            />
          </label>
        </div>

        <div className="rounded-lg bg-gray-50 border p-3">
          <p className="text-xs font-medium text-gray-500 mb-2">Sample button preview</p>
          <div className="flex flex-wrap gap-2">
            {samplePreview.length > 0 ? samplePreview.map(sample => (
              <span key={sample} className="px-2 py-1 text-xs rounded-full bg-white border text-gray-600">{sample}</span>
            )) : <span className="text-xs text-gray-400">No samples configured.</span>}
          </div>
        </div>
      </form>

      {!loaded ? (
        <div className="flex items-center gap-3 text-gray-500">
          <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
          Loading overrides...
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow divide-y">
          {overrides.length === 0 && <p className="p-4 text-gray-500">No overrides. Default hours apply every day.</p>}
          {overrides.map(o => (
            <div key={o.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <span className="font-medium">{o.date}</span>
                {o.isClosed ? (
                  <span className="ml-2 text-red-600 text-sm font-medium">CLOSED</span>
                ) : (
                  <span className="ml-2 text-gray-500 text-sm">{o.openTime && o.closeTime ? `${o.openTime}–${o.closeTime}` : "Modified"}{o.maxCovers ? ` · Max ${o.maxCovers}` : ""}</span>
                )}
                {o.note && <span className="ml-2 text-gray-400 text-sm">— {o.note}</span>}
              </div>
              <button onClick={() => remove(o.id)} className="h-11 px-3 rounded-lg border border-red-200 text-red-600 text-sm transition-all duration-200">Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
