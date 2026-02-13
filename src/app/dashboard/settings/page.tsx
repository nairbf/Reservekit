"use client";

import { useEffect, useMemo, useState } from "react";

type SettingsTab = "restaurant" | "reservations" | "notifications" | "license";

type SettingsMap = Record<string, string>;

const TABS: Array<{ key: SettingsTab; label: string; description: string }> = [
  { key: "restaurant", label: "Restaurant", description: "Branding, homepage, and contact details" },
  { key: "reservations", label: "Reservations", description: "Booking rules, deposits, and cutoffs" },
  { key: "notifications", label: "Notifications", description: "Email, reminders, and staff alerts" },
  { key: "license", label: "License", description: "Read-only plan and feature status" },
];

const FEATURE_ROWS = [
  { key: "feature_sms", label: "SMS Notifications" },
  { key: "feature_floorplan", label: "Visual Floor Plan" },
  { key: "feature_reporting", label: "Reporting Dashboard" },
  { key: "feature_guest_history", label: "Guest History" },
  { key: "feature_event_ticketing", label: "Event Ticketing" },
];

const ACCENT_PRESETS = [
  { label: "Navy", value: "#1e3a5f" },
  { label: "Forest", value: "#2d5016" },
  { label: "Burgundy", value: "#5f1e2e" },
  { label: "Slate", value: "#3f4f5f" },
  { label: "Gold", value: "#5f4b1e" },
];

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium mb-1">{children}</label>;
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm"
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl shadow p-4 sm:p-6">
      <h2 className="text-lg font-bold mb-4">{title}</h2>
      {children}
    </section>
  );
}

function planBadge(plan: string) {
  if (plan === "FULL_SUITE") return "bg-amber-100 text-amber-800 border-amber-200";
  if (plan === "SERVICE_PRO") return "bg-blue-100 text-blue-800 border-blue-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

function statusBadge(status: string) {
  if (status === "ACTIVE") return "bg-green-100 text-green-800 border-green-200";
  if (status === "TRIAL") return "bg-amber-100 text-amber-800 border-amber-200";
  if (status === "SUSPENDED") return "bg-red-100 text-red-700 border-red-200";
  if (status === "CANCELLED") return "bg-red-100 text-red-700 border-red-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

function formatDateTime(value: string) {
  if (!value) return "Never";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString();
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("restaurant");
  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [licenseBusy, setLicenseBusy] = useState(false);
  const [licenseMessage, setLicenseMessage] = useState("");
  const [showLicenseKey, setShowLicenseKey] = useState(false);

  const smsEnabled = settings.feature_sms === "true";

  async function loadSettings() {
    const response = await fetch("/api/settings");
    const data = (await response.json()) as SettingsMap;
    setSettings(data);
  }

  useEffect(() => {
    loadSettings()
      .catch(() => setSettings({}))
      .finally(() => setLoading(false));
  }, []);

  function setField(key: string, value: string) {
    setSettings((previous) => ({ ...previous, [key]: value }));
    setSaved(false);
  }

  async function saveChanges() {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } finally {
      setSaving(false);
    }
  }

  async function validateNow() {
    setLicenseBusy(true);
    setLicenseMessage("");
    try {
      const response = await fetch("/api/license/validate", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setLicenseMessage(data.error || "License validation failed.");
      } else {
        setLicenseMessage("License validated and synced.");
      }
      await loadSettings();
    } catch {
      setLicenseMessage("Could not validate license right now.");
    } finally {
      setLicenseBusy(false);
    }
  }

  async function copyLicenseKey() {
    const key = settings.license_key || "";
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      setLicenseMessage("License key copied.");
    } catch {
      setLicenseMessage("Copy failed.");
    }
  }

  const maskedLicenseKey = useMemo(() => {
    const raw = settings.license_key || "";
    if (!raw) return "Not configured";
    if (showLicenseKey) return raw;
    if (raw.length <= 8) return "••••••••";
    return `${raw.slice(0, 4)}••••••••${raw.slice(-4)}`;
  }, [settings.license_key, showLicenseKey]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-gray-500">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        Loading settings...
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-gray-500">Configure your restaurant profile and reservation operations.</p>
        </div>
        {activeTab !== "license" && (
          <button
            onClick={saveChanges}
            disabled={saving}
            className="h-11 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-70"
          >
            {saving ? "Saving..." : saved ? "✓ Saved" : "Save Changes"}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`min-w-[170px] rounded-xl border px-3 py-2 text-left transition-all ${active ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white"}`}
            >
              <div className={`text-sm font-semibold ${active ? "text-blue-700" : "text-gray-900"}`}>{tab.label}</div>
              <div className="text-[11px] text-gray-500">{tab.description}</div>
            </button>
          );
        })}
      </div>

      {activeTab === "restaurant" && (
        <div className="space-y-6">
          <Section title="Identity">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Restaurant Name" value={settings.restaurantName || ""} onChange={(v) => setField("restaurantName", v)} />
              <Field label="Slug" value={settings.slug || "reef"} onChange={(v) => setField("slug", v)} placeholder="reef" />
              <Field label="Tagline" value={settings.tagline || ""} onChange={(v) => setField("tagline", v)} />
              <Field label="Hero Image URL" value={settings.heroImageUrl || ""} onChange={(v) => setField("heroImageUrl", v)} />
            </div>
            <div className="mt-4">
              <Label>Description</Label>
              <textarea
                value={settings.description || ""}
                onChange={(event) => setField("description", event.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Accent Preset</Label>
                <select
                  value={ACCENT_PRESETS.some((preset) => preset.value.toLowerCase() === (settings.accentColor || "").toLowerCase()) ? settings.accentColor : "custom"}
                  onChange={(event) => {
                    if (event.target.value !== "custom") setField("accentColor", event.target.value);
                  }}
                  className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm"
                >
                  {ACCENT_PRESETS.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label} ({preset.value})
                    </option>
                  ))}
                  <option value="custom">Custom</option>
                </select>
              </div>
              <Field label="Custom Accent Hex" value={settings.accentColor || "#1e3a5f"} onChange={(v) => setField("accentColor", v)} />
            </div>
            <div className="mt-4">
              <Field
                label="Announcement Banner"
                value={settings.announcementText || ""}
                onChange={(v) => setField("announcementText", v)}
                placeholder="Leave blank to hide"
              />
            </div>
          </Section>

          <Section title="Contact">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone" value={settings.phone || ""} onChange={(v) => setField("phone", v)} />
              <Field label="Public Email" value={settings.contactEmail || ""} onChange={(v) => setField("contactEmail", v)} />
              <Field label="Address" value={settings.address || ""} onChange={(v) => setField("address", v)} />
              <Field label="Instagram URL" value={settings.socialInstagram || ""} onChange={(v) => setField("socialInstagram", v)} />
              <Field label="Facebook URL" value={settings.socialFacebook || ""} onChange={(v) => setField("socialFacebook", v)} />
            </div>
          </Section>
        </div>
      )}

      {activeTab === "reservations" && (
        <div className="space-y-6">
          <Section title="Booking Rules">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Default Open Time" type="time" value={settings.openTime || "17:00"} onChange={(v) => setField("openTime", v)} />
              <Field label="Default Close Time" type="time" value={settings.closeTime || "22:00"} onChange={(v) => setField("closeTime", v)} />
              <Field label="Slot Duration (minutes)" type="number" value={settings.slotInterval || "30"} onChange={(v) => setField("slotInterval", v)} />
              <Field label="Max Party Size" type="number" value={settings.maxPartySize || "8"} onChange={(v) => setField("maxPartySize", v)} />
              <Field label="Max Covers Per Slot" type="number" value={settings.maxCoversPerSlot || "40"} onChange={(v) => setField("maxCoversPerSlot", v)} />
              <Field label="Booking Lead Time (hours)" type="number" value={settings.bookingLeadHours || "0"} onChange={(v) => setField("bookingLeadHours", v)} />
              <Field label="Default Party Sizes" value={settings.defaultPartySizes || "2,4,6,8"} onChange={(v) => setField("defaultPartySizes", v)} />
              <Field label="Last Seating Buffer (minutes)" type="number" value={settings.lastSeatingBufferMin || "90"} onChange={(v) => setField("lastSeatingBufferMin", v)} />
              <Field label="Self-Service Cutoff (hours)" type="number" value={settings.selfServiceCutoffHours || "2"} onChange={(v) => setField("selfServiceCutoffHours", v)} />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Approval Mode</Label>
                <select
                  value={settings.reservationApprovalMode || "manual"}
                  onChange={(event) => setField("reservationApprovalMode", event.target.value)}
                  className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm"
                >
                  <option value="manual">Manual approval</option>
                  <option value="auto">Auto-confirm</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <Label>Cancellation Policy</Label>
              <textarea
                value={settings.cancellationPolicy || ""}
                onChange={(event) => setField("cancellationPolicy", event.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="Example: Cancellations within 2 hours may be charged."
              />
            </div>
          </Section>

          <Section title="Deposits & No-Show Protection">
            <label className="mb-4 flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={(settings.depositEnabled || settings.depositsEnabled) === "true"}
                onChange={(event) => {
                  const value = event.target.checked ? "true" : "false";
                  setField("depositEnabled", value);
                  setField("depositsEnabled", value);
                }}
                className="h-4 w-4"
              />
              Enable deposits / card holds
            </label>

            {(settings.depositEnabled || settings.depositsEnabled) === "true" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Deposit Type</Label>
                  <select
                    value={settings.depositType || "hold"}
                    onChange={(event) => setField("depositType", event.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm"
                  >
                    <option value="hold">Card hold (authorize only)</option>
                    <option value="deposit">Deposit (charge now)</option>
                  </select>
                </div>
                <Field label="Deposit Amount (cents)" type="number" value={settings.depositAmount || "0"} onChange={(v) => setField("depositAmount", v)} />
                <Field
                  label="Apply at Party Size >="
                  type="number"
                  value={settings.depositMinPartySize || settings.depositMinParty || "2"}
                  onChange={(v) => {
                    setField("depositMinPartySize", v);
                    setField("depositMinParty", v);
                  }}
                />
                <div className="sm:col-span-2">
                  <Label>Deposit Message</Label>
                  <textarea
                    value={settings.depositMessage || ""}
                    onChange={(event) => setField("depositMessage", event.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            )}

            <label className="mt-4 flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={settings.noshowChargeEnabled === "true"}
                onChange={(event) => setField("noshowChargeEnabled", event.target.checked ? "true" : "false")}
                className="h-4 w-4"
              />
              Charge no-shows when a card is on file
            </label>

            {settings.noshowChargeEnabled === "true" && (
              <div className="mt-4 max-w-sm">
                <Field
                  label="No-Show Charge Amount (cents)"
                  type="number"
                  value={settings.noshowChargeAmount || settings.depositAmount || "0"}
                  onChange={(v) => setField("noshowChargeAmount", v)}
                />
              </div>
            )}
          </Section>
        </div>
      )}

      {activeTab === "notifications" && (
        <div className="space-y-6">
          <Section title="Email Delivery (SMTP)">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="SMTP Host" value={settings.smtpHost || ""} onChange={(v) => setField("smtpHost", v)} placeholder="smtp.gmail.com" />
              <Field label="SMTP Port" value={settings.smtpPort || "587"} onChange={(v) => setField("smtpPort", v)} />
              <Field label="SMTP User" value={settings.smtpUser || ""} onChange={(v) => setField("smtpUser", v)} />
              <Field label="SMTP Password" type="password" value={settings.smtpPass || ""} onChange={(v) => setField("smtpPass", v)} />
              <Field label="From Address" value={settings.smtpFrom || ""} onChange={(v) => setField("smtpFrom", v)} />
              <Field label="Reminder Lead Hours" type="number" value={settings.reminderLeadHours || "24"} onChange={(v) => setField("reminderLeadHours", v)} />
            </div>
          </Section>

          {smsEnabled ? (
            <Section title="SMS Delivery (Enabled by License)">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Twilio Account SID" value={settings.twilioSid || ""} onChange={(v) => setField("twilioSid", v)} />
                <Field label="Twilio Auth Token" type="password" value={settings.twilioToken || ""} onChange={(v) => setField("twilioToken", v)} />
                <Field label="Twilio Phone Number" value={settings.twilioPhone || ""} onChange={(v) => setField("twilioPhone", v)} placeholder="+15551234567" />
              </div>
            </Section>
          ) : (
            <Section title="SMS Delivery">
              <p className="text-sm text-gray-600">SMS is disabled for your plan. Contact support to enable this feature.</p>
            </Section>
          )}

          <Section title="Staff Notifications">
            <label className="mb-4 flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={settings.staffNotificationsEnabled === "true"}
                onChange={(event) => setField("staffNotificationsEnabled", event.target.checked ? "true" : "false")}
                className="h-4 w-4"
              />
              Enable manager alert emails
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Notification Email"
                value={settings.staffNotificationEmail || ""}
                onChange={(v) => setField("staffNotificationEmail", v)}
              />
              <Field
                label="Large Party Threshold"
                type="number"
                value={settings.largePartyThreshold || "6"}
                onChange={(v) => setField("largePartyThreshold", v)}
              />
            </div>
          </Section>
        </div>
      )}

      {activeTab === "license" && (
        <div className="space-y-6">
          <Section title="License Information">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <Label>License Key</Label>
                <div className="h-11 rounded-lg border border-gray-200 px-3 flex items-center text-sm font-mono">
                  {maskedLicenseKey}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowLicenseKey((value) => !value)}
                  className="h-11 rounded-lg border border-gray-200 px-3 text-sm"
                >
                  {showLicenseKey ? "Hide" : "Reveal"}
                </button>
                <button
                  type="button"
                  onClick={copyLicenseKey}
                  className="h-11 rounded-lg border border-gray-200 px-3 text-sm"
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Plan</div>
                <span className={`mt-1 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${planBadge(settings.license_plan || "CORE")}`}>
                  {settings.license_plan || "CORE"}
                </span>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Status</div>
                <span className={`mt-1 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusBadge(settings.license_status || "UNKNOWN")}`}>
                  {settings.license_status || "UNKNOWN"}
                </span>
              </div>
            </div>

            <div className="mt-4 text-sm text-gray-600">
              Last validated: <span className="font-medium">{formatDateTime(settings.license_last_check || "")}</span>
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={validateNow}
                disabled={licenseBusy}
                className="h-11 rounded-lg bg-gray-900 px-4 text-sm font-medium text-white disabled:opacity-70"
              >
                {licenseBusy ? "Validating..." : "Validate Now"}
              </button>
            </div>

            {licenseMessage && (
              <p className={`mt-3 text-sm ${licenseMessage.toLowerCase().includes("failed") || licenseMessage.toLowerCase().includes("could not") ? "text-red-600" : "text-green-700"}`}>
                {licenseMessage}
              </p>
            )}
          </Section>

          <Section title="Enabled Features">
            <div className="space-y-2">
              {FEATURE_ROWS.map((feature) => {
                const enabled = settings[feature.key] === "true";
                return (
                  <div key={feature.key} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm">
                    <span>{feature.label}</span>
                    <span className={enabled ? "text-green-700" : "text-gray-500"}>{enabled ? "✓ Enabled" : "✕ Disabled"}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-gray-500">Contact support@reservesit.com to change your plan or add features.</p>
          </Section>
        </div>
      )}
    </div>
  );
}
