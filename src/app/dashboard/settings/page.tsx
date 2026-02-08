"use client";
import { useState, useEffect } from "react";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => { fetch("/api/settings").then(r => r.json()).then(setSettings); }, []);

  function set(k: string, v: string) { setSettings(s => ({ ...s, [k]: v })); setSaved(false); }

  async function save() {
    await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return <div className="bg-white rounded shadow p-5 mb-6"><h2 className="font-bold text-lg mb-4">{title}</h2>{children}</div>;
  }
  function Field({ label, value, onChange, type, placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
    return <div className="mb-3"><label className="block text-sm font-medium mb-1">{label}</label><input type={type || "text"} value={value || ""} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full border rounded px-3 py-1.5 text-sm" /></div>;
  }

  return (
    <div className="max-w-2xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <button onClick={save} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">{saved ? "✓ Saved" : "Save Changes"}</button>
      </div>

      <Section title="Restaurant Details">
        <Field label="Name" value={settings.restaurantName} onChange={v => set("restaurantName", v)} placeholder="My Restaurant" />
        <Field label="Phone" value={settings.phone} onChange={v => set("phone", v)} placeholder="(555) 123-4567" />
        <Field label="Address" value={settings.address} onChange={v => set("address", v)} />
      </Section>

      <Section title="Hours & Capacity">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Open Time" value={settings.openTime} onChange={v => set("openTime", v)} type="time" />
          <Field label="Close Time" value={settings.closeTime} onChange={v => set("closeTime", v)} type="time" />
          <Field label="Slot Interval (min)" value={settings.slotInterval} onChange={v => set("slotInterval", v)} />
          <Field label="Max Covers/Slot" value={settings.maxCoversPerSlot} onChange={v => set("maxCoversPerSlot", v)} />
          <Field label="Max Party Size" value={settings.maxPartySize} onChange={v => set("maxPartySize", v)} />
        </div>
      </Section>

      <Section title="Email (SMTP)">
        <div className="grid grid-cols-2 gap-3">
          <Field label="SMTP Host" value={settings.smtpHost} onChange={v => set("smtpHost", v)} placeholder="smtp.gmail.com" />
          <Field label="SMTP Port" value={settings.smtpPort} onChange={v => set("smtpPort", v)} placeholder="587" />
          <Field label="SMTP User" value={settings.smtpUser} onChange={v => set("smtpUser", v)} placeholder="you@gmail.com" />
          <Field label="SMTP Password" value={settings.smtpPass} onChange={v => set("smtpPass", v)} type="password" />
        </div>
        <Field label="From Address" value={settings.smtpFrom} onChange={v => set("smtpFrom", v)} placeholder="reservations@yourrestaurant.com" />
      </Section>

      <Section title="SMS Add-On">
        <Field label="License Key" value={settings.license_sms} onChange={v => set("license_sms", v)} placeholder="RK-SMS-XXXXXXXX" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Twilio Account SID" value={settings.twilioSid} onChange={v => set("twilioSid", v)} placeholder="AC..." />
          <Field label="Twilio Auth Token" value={settings.twilioToken} onChange={v => set("twilioToken", v)} type="password" />
        </div>
        <Field label="Twilio Phone Number" value={settings.twilioPhone} onChange={v => set("twilioPhone", v)} placeholder="+15551234567" />
        <p className="text-xs text-gray-400 mt-1">Get credentials at twilio.com/console. You pay Twilio directly for SMS.</p>
      </Section>

      <Section title="Widget Embed Code">
        <p className="text-sm text-gray-600 mb-2">Paste this on your restaurant website:</p>
        <div className="bg-gray-100 rounded p-3 text-xs font-mono break-all select-all">
          {`<script data-reservekit src="${typeof window !== "undefined" ? window.location.origin : "https://your-domain.com"}/widget.js"></script>`}
        </div>
      </Section>
    </div>
  );
}
