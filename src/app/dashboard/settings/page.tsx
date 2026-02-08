"use client";
import { useState, useEffect } from "react";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(s => { setSettings(s); setLoading(false); });
  }, []);

  function set(k: string, v: string) {
    setSettings(s => ({ ...s, [k]: v }));
    setSaved(false);
  }

  async function save() {
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div className="bg-white rounded-xl shadow p-4 sm:p-6 mb-6">
        <h2 className="font-bold text-lg mb-4">{title}</h2>
        {children}
      </div>
    );
  }

  function Field({ label, value, onChange, type, placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
    return (
      <div>
        <label className="block text-sm font-medium mb-1">{label}</label>
        <input
          type={type || "text"}
          value={value || ""}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-11 w-full border rounded px-3 text-sm"
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-gray-500">
        <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
        Loading settings...
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-gray-500 text-sm">General configuration, email, and SMS</p>
        </div>
        <button onClick={save} className="h-11 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium transition-all duration-200">
          {saved ? "✓ Saved" : "Save Changes"}
        </button>
      </div>

      <Section title="Restaurant Details">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Name" value={settings.restaurantName} onChange={v => set("restaurantName", v)} placeholder="My Restaurant" />
          <Field label="Phone" value={settings.phone} onChange={v => set("phone", v)} placeholder="(555) 123-4567" />
        </div>
        <div className="mt-4">
          <Field label="Address" value={settings.address} onChange={v => set("address", v)} />
        </div>
      </Section>

      <Section title="Hours & Capacity">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Open Time" value={settings.openTime} onChange={v => set("openTime", v)} type="time" />
          <Field label="Close Time" value={settings.closeTime} onChange={v => set("closeTime", v)} type="time" />
          <Field label="Slot Interval (min)" value={settings.slotInterval} onChange={v => set("slotInterval", v)} />
          <Field label="Max Covers/Slot" value={settings.maxCoversPerSlot} onChange={v => set("maxCoversPerSlot", v)} />
          <Field label="Max Party Size" value={settings.maxPartySize} onChange={v => set("maxPartySize", v)} />
        </div>
      </Section>

      <Section title="Email (SMTP)">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="SMTP Host" value={settings.smtpHost} onChange={v => set("smtpHost", v)} placeholder="smtp.gmail.com" />
          <Field label="SMTP Port" value={settings.smtpPort} onChange={v => set("smtpPort", v)} placeholder="587" />
          <Field label="SMTP User" value={settings.smtpUser} onChange={v => set("smtpUser", v)} placeholder="you@gmail.com" />
          <Field label="SMTP Password" value={settings.smtpPass} onChange={v => set("smtpPass", v)} type="password" />
        </div>
        <div className="mt-4">
          <Field label="From Address" value={settings.smtpFrom} onChange={v => set("smtpFrom", v)} placeholder="reservations@yourrestaurant.com" />
        </div>
      </Section>

      <Section title="SMS Add-On">
        <Field label="License Key" value={settings.license_sms} onChange={v => set("license_sms", v)} placeholder="RK-SMS-XXXXXXXX" />
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <Field label="Twilio Account SID" value={settings.twilioSid} onChange={v => set("twilioSid", v)} placeholder="AC..." />
          <Field label="Twilio Auth Token" value={settings.twilioToken} onChange={v => set("twilioToken", v)} type="password" />
        </div>
        <div className="mt-4">
          <Field label="Twilio Phone Number" value={settings.twilioPhone} onChange={v => set("twilioPhone", v)} placeholder="+15551234567" />
          <p className="text-xs text-gray-400 mt-2">Get credentials at twilio.com/console. You pay Twilio directly for SMS.</p>
        </div>
      </Section>

      <Section title="Widget Embed Code">
        <p className="text-sm text-gray-600 mb-2">Paste this on your restaurant website:</p>
        <div className="bg-gray-100 rounded-lg p-3 text-xs font-mono break-all select-all">
          {`<script data-reservekit src="${typeof window !== "undefined" ? window.location.origin : "https://your-domain.com"}/widget.js"></script>`}
        </div>
      </Section>
    </div>
  );
}
