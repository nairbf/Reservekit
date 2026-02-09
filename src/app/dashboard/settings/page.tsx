"use client";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type SettingsTab = "restaurant" | "operations" | "communications" | "booking" | "integrations";

interface TableItem {
  id: number;
  name: string;
}

interface MappingRow {
  rowId: string;
  reservekitTableId: number | "";
  spotOnTable: string;
}

interface SpotOnStatus {
  licensed: boolean;
  configured: boolean;
  spotonLastSync: string | null;
  openChecks: number;
}

const TABS: Array<{ key: SettingsTab; label: string; desc: string }> = [
  { key: "restaurant", label: "Restaurant", desc: "Basic identity and contact info" },
  { key: "operations", label: "Operations", desc: "Capacity and fallback hours" },
  { key: "communications", label: "Comms", desc: "Email + SMS delivery setup" },
  { key: "booking", label: "Booking UI", desc: "Deposit policy and guest messaging" },
  { key: "integrations", label: "Integrations", desc: "SpotOn POS sync and mapping" },
];

interface TabButtonProps {
  tab: SettingsTab;
  label: string;
  desc: string;
  activeTab: SettingsTab;
  onSelect: (tab: SettingsTab) => void;
}

function TabButton({ tab, label, desc, activeTab, onSelect }: TabButtonProps) {
  const active = activeTab === tab;
  return (
    <button
      type="button"
      onClick={() => onSelect(tab)}
      className={`text-left rounded-xl border px-3 py-2 min-w-[170px] transition-all duration-200 ${active ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"}`}
    >
      <div className={`text-sm font-semibold ${active ? "text-blue-700" : "text-gray-800"}`}>{label}</div>
      <div className="text-[11px] text-gray-500">{desc}</div>
    </button>
  );
}

function Section({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl shadow p-4 sm:p-6 ${className}`}>
      <h2 className="font-bold text-lg mb-4">{title}</h2>
      {children}
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}

function Field({ label, value, onChange, type, placeholder }: FieldProps) {
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

function makeRowId() {
  return `map-${Math.random().toString(36).slice(2, 10)}`;
}

function formatSyncTime(value: string | null): string {
  if (!value) return "Never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SettingsTab>("restaurant");

  const [tables, setTables] = useState<TableItem[]>([]);
  const [mappingRows, setMappingRows] = useState<MappingRow[]>([{ rowId: makeRowId(), reservekitTableId: "", spotOnTable: "" }]);
  const [mappingMessage, setMappingMessage] = useState<string>("");
  const [spotOnStatus, setSpotOnStatus] = useState<SpotOnStatus>({ licensed: true, configured: false, spotonLastSync: null, openChecks: 0 });
  const [spotOnMessage, setSpotOnMessage] = useState<string>("");
  const [testingConnection, setTestingConnection] = useState(false);
  const [syncingSpotOn, setSyncingSpotOn] = useState(false);
  const [savingMapping, setSavingMapping] = useState(false);
  const tour = searchParams.get("tour");
  const showTourHighlight = searchParams.get("fromSetup") === "1" && (tour === "settings" || tour === "publish");

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then(r => r.json()),
      fetch("/api/spoton/mapping").then(async r => (r.ok ? r.json() : null)),
      fetch("/api/spoton/sync").then(async r => (r.ok ? r.json() : null)),
    ])
      .then(([s, mappingData, syncData]) => {
        setSettings(s);
        if (mappingData?.tables) {
          setTables(mappingData.tables as TableItem[]);
        }
        if (mappingData?.mappings && Array.isArray(mappingData.mappings) && mappingData.mappings.length > 0) {
          setMappingRows(
            mappingData.mappings.map((m: { reservekitTableId: number; spotOnTable: string }) => ({
              rowId: makeRowId(),
              reservekitTableId: m.reservekitTableId,
              spotOnTable: m.spotOnTable || "",
            })),
          );
        }
        if (syncData) {
          setSpotOnStatus({
            licensed: syncData.licensed !== false,
            configured: Boolean(syncData.configured),
            spotonLastSync: syncData.spotonLastSync || null,
            openChecks: Number(syncData.openChecks || 0),
          });
        }
      })
      .finally(() => setLoading(false));
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

  async function refreshSpotOnStatus() {
    const res = await fetch("/api/spoton/sync");
    if (!res.ok) return;
    const data = await res.json();
    setSpotOnStatus({
      licensed: data.licensed !== false,
      configured: Boolean(data.configured),
      spotonLastSync: data.spotonLastSync || null,
      openChecks: Number(data.openChecks || 0),
    });
  }

  async function testConnection() {
    setTestingConnection(true);
    setSpotOnMessage("");
    try {
      const res = await fetch("/api/spoton/test", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setSpotOnMessage(`Connected to ${data.locationName} (${data.environment}).`);
      } else {
        setSpotOnMessage(`Connection failed: ${data.error || "Unknown error"}`);
      }
    } finally {
      setTestingConnection(false);
    }
  }

  async function syncNow() {
    setSyncingSpotOn(true);
    setSpotOnMessage("");
    try {
      const res = await fetch("/api/spoton/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        const count = Array.isArray(data.openChecks) ? data.openChecks.length : Number(data.openChecks || 0);
        setSpotOnMessage(`Sync complete. ${count} open checks.`);
        setSpotOnStatus(s => ({
          ...s,
          spotonLastSync: data.timestamp || new Date().toISOString(),
          openChecks: count,
          configured: true,
        }));
      } else {
        setSpotOnMessage(`Sync failed: ${data.error || "Unknown error"}`);
      }
    } finally {
      setSyncingSpotOn(false);
    }
  }

  async function autoMatch() {
    setSavingMapping(true);
    setMappingMessage("");
    try {
      const res = await fetch("/api/spoton/mapping", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "auto" }),
      });
      const data = await res.json();
      if (res.ok) {
        const nextRows: MappingRow[] = (Array.isArray(data.matches) ? data.matches : []).map((m: { reservekitTableId: number; spotOnTable: string }) => ({
          rowId: makeRowId(),
          reservekitTableId: m.reservekitTableId,
          spotOnTable: m.spotOnTable,
        }));
        setMappingRows(nextRows.length > 0 ? nextRows : [{ rowId: makeRowId(), reservekitTableId: "", spotOnTable: "" }]);
        setMappingMessage(`Auto-matched ${Number(data.count || 0)} table(s).`);
      } else {
        setMappingMessage(data.error || "Auto-match failed.");
      }
    } finally {
      setSavingMapping(false);
    }
  }

  async function saveMapping() {
    setSavingMapping(true);
    setMappingMessage("");
    try {
      const mappings = mappingRows
        .filter(row => row.reservekitTableId !== "" && row.spotOnTable.trim())
        .map(row => ({
          reservekitTableId: Number(row.reservekitTableId),
          spotOnTable: row.spotOnTable.trim(),
        }));
      const res = await fetch("/api/spoton/mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings }),
      });
      const data = await res.json();
      if (res.ok) {
        setMappingMessage(`Saved ${Number(data.saved || mappings.length)} mapping(s).`);
      } else {
        setMappingMessage(data.error || "Failed to save mappings.");
      }
      await refreshSpotOnStatus();
    } finally {
      setSavingMapping(false);
    }
  }

  function setMappingRow(rowId: string, patch: Partial<MappingRow>) {
    setMappingRows(rows => rows.map(row => (row.rowId === rowId ? { ...row, ...patch } : row)));
  }

  function addMappingRow() {
    setMappingRows(rows => [...rows, { rowId: makeRowId(), reservekitTableId: "", spotOnTable: "" }]);
  }

  function removeMappingRow(rowId: string) {
    setMappingRows(rows => {
      const next = rows.filter(row => row.rowId !== rowId);
      return next.length > 0 ? next : [{ rowId: makeRowId(), reservekitTableId: "", spotOnTable: "" }];
    });
  }

  const samplePreview = useMemo(
    () => (settings.reserveRequestSamples || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean),
    [settings.reserveRequestSamples],
  );

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-gray-500">
        <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
        Loading settings...
      </div>
    );
  }

  return (
    <div className={`max-w-5xl space-y-6 ${showTourHighlight ? "rounded-2xl ring-2 ring-blue-300 p-2" : ""}`}>
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-gray-500 text-sm">Use tabs to expand only the setup area you need.</p>
        </div>
        <button onClick={save} className="h-11 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium transition-all duration-200">
          {saved ? "✓ Saved" : "Save Changes"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map(tab => (
          <TabButton
            key={tab.key}
            tab={tab.key}
            label={tab.label}
            desc={tab.desc}
            activeTab={activeTab}
            onSelect={setActiveTab}
          />
        ))}
      </div>

      {activeTab === "restaurant" && (
        <Section title="Restaurant Details">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Name" value={settings.restaurantName} onChange={v => set("restaurantName", v)} placeholder="My Restaurant" />
            <Field label="Phone" value={settings.phone} onChange={v => set("phone", v)} placeholder="(555) 123-4567" />
          </div>
          <div className="mt-4">
            <Field label="Address" value={settings.address} onChange={v => set("address", v)} />
          </div>
        </Section>
      )}

      {activeTab === "operations" && (
        <Section title="Operations Defaults">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Default Open Time" value={settings.openTime} onChange={v => set("openTime", v)} type="time" />
            <Field label="Default Close Time" value={settings.closeTime} onChange={v => set("closeTime", v)} type="time" />
            <Field label="Slot Interval (min)" value={settings.slotInterval} onChange={v => set("slotInterval", v)} />
            <Field label="Last Seating Buffer (min)" value={settings.lastSeatingBufferMin} onChange={v => set("lastSeatingBufferMin", v)} />
            <Field label="Max Covers/Slot" value={settings.maxCoversPerSlot} onChange={v => set("maxCoversPerSlot", v)} />
            <Field label="Max Party Size" value={settings.maxPartySize} onChange={v => set("maxPartySize", v)} />
          </div>
          <p className="text-xs text-gray-500 mt-3">Tip: weekly/day-specific schedule editing lives in the Scheduling page.</p>
        </Section>
      )}

      {activeTab === "communications" && (
        <div className="space-y-6">
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
            <Field label="License Key" value={settings.license_sms} onChange={v => set("license_sms", v)} placeholder="RS-SMS-XXXXXXXX" />
            <div className="grid sm:grid-cols-2 gap-4 mt-4">
              <Field label="Twilio Account SID" value={settings.twilioSid} onChange={v => set("twilioSid", v)} placeholder="AC..." />
              <Field label="Twilio Auth Token" value={settings.twilioToken} onChange={v => set("twilioToken", v)} type="password" />
            </div>
            <div className="mt-4">
              <Field label="Twilio Phone Number" value={settings.twilioPhone} onChange={v => set("twilioPhone", v)} placeholder="+15551234567" />
              <p className="text-xs text-gray-400 mt-2">Get credentials at twilio.com/console. You pay Twilio directly for SMS.</p>
            </div>
          </Section>

          <Section title="Staff Notifications">
            <label className="flex items-center gap-2 text-sm font-medium mb-3">
              <input
                type="checkbox"
                checked={settings.staffNotificationsEnabled === "true"}
                onChange={e => set("staffNotificationsEnabled", e.target.checked ? "true" : "false")}
                className="h-4 w-4"
              />
              Enable manager alert emails
            </label>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field
                label="Notification Email"
                value={settings.staffNotificationEmail || ""}
                onChange={v => set("staffNotificationEmail", v)}
                placeholder="manager@restaurant.com"
              />
              <Field
                label="Large Party Threshold"
                value={settings.largePartyThreshold || "6"}
                onChange={v => set("largePartyThreshold", v)}
                type="number"
              />
            </div>
          </Section>
        </div>
      )}

      {activeTab === "booking" && (
        <div className="space-y-6">
          <Section title="Deposits & No-Show Protection">
            <label className="flex items-center gap-2 text-sm font-medium mb-4">
              <input
                type="checkbox"
                checked={(settings.depositEnabled || settings.depositsEnabled) === "true"}
                onChange={e => {
                  const next = e.target.checked ? "true" : "false";
                  set("depositEnabled", next);
                  set("depositsEnabled", next);
                }}
                className="h-4 w-4"
              />
              Enable deposits / card guarantees
            </label>

            {(settings.depositEnabled || settings.depositsEnabled) === "true" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Deposit Type</label>
                  <select
                    value={settings.depositType || "hold"}
                    onChange={e => set("depositType", e.target.value)}
                    className="h-11 w-full border rounded px-3 text-sm"
                  >
                    <option value="hold">Card Hold (authorize only)</option>
                    <option value="deposit">Deposit (charge now)</option>
                  </select>
                </div>
                <Field
                  label="Deposit Amount (cents)"
                  value={settings.depositAmount || "0"}
                  onChange={v => set("depositAmount", v)}
                  type="number"
                />
                <Field
                  label="Apply at Party Size >="
                  value={settings.depositMinPartySize || settings.depositMinParty || "2"}
                  onChange={v => {
                    set("depositMinPartySize", v);
                    set("depositMinParty", v);
                  }}
                  type="number"
                />
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-1">Deposit Message</label>
                  <textarea
                    value={settings.depositMessage || ""}
                    onChange={e => set("depositMessage", e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm"
                    rows={2}
                  />
                </div>
              </div>
            )}

            <label className="flex items-center gap-2 text-sm font-medium mb-3">
              <input
                type="checkbox"
                checked={settings.noshowChargeEnabled === "true"}
                onChange={e => set("noshowChargeEnabled", e.target.checked ? "true" : "false")}
                className="h-4 w-4"
              />
              Charge no-shows automatically when a card is on file
            </label>
            {settings.noshowChargeEnabled === "true" && (
              <Field
                label="No-Show Charge Amount (cents)"
                value={settings.noshowChargeAmount || settings.depositAmount || "0"}
                onChange={v => set("noshowChargeAmount", v)}
                type="number"
              />
            )}
            <p className="text-xs text-gray-500 mt-3">
              Example: 2500 cents = $25.00
            </p>
          </Section>

          <Section title="Express Dining">
            <Field
              label="Express Dining License Key"
              value={settings.license_expressdining || ""}
              onChange={v => set("license_expressdining", v)}
              placeholder="RS-XDN-XXXXXXXX"
            />
            <div className="mt-4">
              <label className="flex items-center gap-2 text-sm font-medium mb-4">
                <input
                  type="checkbox"
                  checked={settings.expressDiningEnabled === "true"}
                  onChange={e => set("expressDiningEnabled", e.target.checked ? "true" : "false")}
                  className="h-4 w-4"
                />
                Enable Express Dining pre-orders
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Mode</label>
                <select
                  value={settings.expressDiningMode || "prices"}
                  onChange={e => set("expressDiningMode", e.target.value)}
                  className="h-11 w-full border rounded px-3 text-sm"
                >
                  <option value="prices">Show prices</option>
                  <option value="browse">Browse only</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Payment</label>
                <select
                  value={settings.expressDiningPayment || "optional"}
                  onChange={e => set("expressDiningPayment", e.target.value)}
                  className="h-11 w-full border rounded px-3 text-sm"
                >
                  <option value="precharge">Pre-charge required</option>
                  <option value="optional">Optional (guest chooses)</option>
                  <option value="none">No payment (preferences only)</option>
                </select>
              </div>
              <Field
                label="Cutoff Hours"
                value={settings.expressDiningCutoffHours || "2"}
                onChange={v => set("expressDiningCutoffHours", v)}
                type="number"
              />
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1">Guest Message</label>
                <textarea
                  value={settings.expressDiningMessage || ""}
                  onChange={e => set("expressDiningMessage", e.target.value)}
                  rows={2}
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="Pre-select your meal and skip the wait! Your order will be ready when you arrive."
                />
              </div>
            </div>
          </Section>

          <Section title="Reservation Widget Messaging">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <Field label="Reserve Heading" value={settings.reserveHeading || ""} onChange={v => set("reserveHeading", v)} />
              <Field label="Reserve Subheading" value={settings.reserveSubheading || ""} onChange={v => set("reserveSubheading", v)} />
              <div className="sm:col-span-2">
                <Field label="Confirmation Message" value={settings.reserveConfirmationMessage || ""} onChange={v => set("reserveConfirmationMessage", v)} />
              </div>
              <div className="sm:col-span-2">
                <Field label="Request Form Helper Text" value={settings.reserveRequestDisclaimer || ""} onChange={v => set("reserveRequestDisclaimer", v)} />
              </div>
              <div className="sm:col-span-2">
                <Field label="Special Request Placeholder" value={settings.reserveRequestPlaceholder || ""} onChange={v => set("reserveRequestPlaceholder", v)} />
              </div>
              <div className="sm:col-span-2">
                <Field label="Quick Request Samples (comma-separated)" value={settings.reserveRequestSamples || ""} onChange={v => set("reserveRequestSamples", v)} />
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 border p-3">
              <p className="text-xs font-medium text-gray-500 mb-2">Quick sample button preview</p>
              <div className="flex flex-wrap gap-2">
                {samplePreview.length > 0 ? samplePreview.map(sample => (
                  <span key={sample} className="px-2 py-1 text-xs rounded-full bg-white border text-gray-600">{sample}</span>
                )) : <span className="text-xs text-gray-400">No samples configured.</span>}
              </div>
            </div>
          </Section>

          <Section title="Loyalty Opt-In">
            <label className="flex items-center gap-2 text-sm font-medium mb-4">
              <input
                type="checkbox"
                checked={settings.loyaltyOptInEnabled === "true"}
                onChange={e => set("loyaltyOptInEnabled", e.target.checked ? "true" : "false")}
                className="h-4 w-4"
              />
              Ask new phone numbers to opt in to loyalty communications
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Program Name"
                value={settings.loyaltyProgramName || ""}
                onChange={v => set("loyaltyProgramName", v)}
                placeholder="VIP Club"
              />
              <Field
                label="Checkbox Label"
                value={settings.loyaltyOptInLabel || ""}
                onChange={v => set("loyaltyOptInLabel", v)}
                placeholder="Yes, send me loyalty updates by SMS."
              />
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1">Prompt Message</label>
                <textarea
                  value={settings.loyaltyOptInMessage || ""}
                  onChange={e => set("loyaltyOptInMessage", e.target.value)}
                  rows={2}
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="Join our loyalty list for offers and event updates."
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">Guests are prompted once per phone number and their choice is remembered.</p>
          </Section>

          <Section title="Widget Embed Code" className={tour === "publish" ? "ring-2 ring-blue-300" : ""}>
            <p className="text-sm text-gray-600 mb-2">Paste this on your restaurant website:</p>
            <div className="bg-gray-100 rounded-lg p-3 text-xs font-mono break-all select-all">
              {`<script data-reservesit src="${typeof window !== "undefined" ? window.location.origin : "https://your-domain.com"}/widget.js"></script>`}
            </div>
          </Section>
        </div>
      )}

      {activeTab === "integrations" && (
        <Section title="SpotOn POS Integration">
          <Field label="Event Ticketing License Key" value={settings.license_events || ""} onChange={v => set("license_events", v)} placeholder="RS-EVT-XXXXXXXX" />
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="POS License Key" value={settings.license_pos} onChange={v => set("license_pos", v)} placeholder="RS-POS-XXXXXXXX" />
            <Field label="SpotOn API Key" value={settings.spotonApiKey} onChange={v => set("spotonApiKey", v)} placeholder="Your SpotOn API key" />
            <Field label="Location ID" value={settings.spotonLocationId} onChange={v => set("spotonLocationId", v)} placeholder="Location152" />
            <div>
              <label className="block text-sm font-medium mb-1">Environment</label>
              <select
                value={settings.spotonEnvironment || "production"}
                onChange={e => set("spotonEnvironment", e.target.value)}
                className="h-11 w-full border rounded px-3 text-sm"
              >
                <option value="production">Production</option>
                <option value="qa">QA</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <input
              id="spotonUseMock"
              type="checkbox"
              checked={settings.spotonUseMock === "true"}
              onChange={e => set("spotonUseMock", e.target.checked ? "true" : "false")}
              className="h-4 w-4"
            />
            <label htmlFor="spotonUseMock" className="text-sm text-gray-700">Use Mock Data</label>
          </div>

          <div className="mt-4 rounded-lg border border-gray-200 p-3 bg-gray-50 text-sm">
            <div className="font-medium text-gray-800">Sync Status</div>
            <div className="text-gray-600 mt-1">Configured: {spotOnStatus.configured ? "Yes" : "No"}</div>
            <div className="text-gray-600">Last Sync: {formatSyncTime(spotOnStatus.spotonLastSync)}</div>
            <div className="text-gray-600">Open Checks: {spotOnStatus.openChecks}</div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={testConnection}
              disabled={testingConnection}
              className="h-11 px-4 rounded-lg border border-gray-200 bg-white text-sm font-medium transition-all duration-200 disabled:opacity-60"
            >
              {testingConnection ? "Testing..." : "Test Connection"}
            </button>
            <button
              onClick={syncNow}
              disabled={syncingSpotOn}
              className="h-11 px-4 rounded-lg bg-gray-900 text-white text-sm font-medium transition-all duration-200 disabled:opacity-60"
            >
              {syncingSpotOn ? "Syncing..." : "Sync Now"}
            </button>
          </div>

          {spotOnMessage && (
            <p className={`text-sm mt-3 ${spotOnMessage.toLowerCase().includes("failed") ? "text-red-600" : "text-green-700"}`}>
              {spotOnMessage}
            </p>
          )}

          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h3 className="font-semibold">Table Name Mapping</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={autoMatch}
                  disabled={savingMapping}
                  className="h-11 px-3 rounded-lg border border-gray-200 text-sm transition-all duration-200 disabled:opacity-60"
                >
                  Auto-Match
                </button>
                <button
                  onClick={saveMapping}
                  disabled={savingMapping}
                  className="h-11 px-3 rounded-lg bg-blue-600 text-white text-sm transition-all duration-200 disabled:opacity-60"
                >
                  Save Mapping
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {mappingRows.map(row => (
                <div key={row.rowId} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <select
                    value={row.reservekitTableId}
                    onChange={e => setMappingRow(row.rowId, { reservekitTableId: e.target.value ? Number(e.target.value) : "" })}
                    className="h-11 border rounded px-3 text-sm"
                  >
                    <option value="">ReserveSit Table</option>
                    {tables.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <input
                    value={row.spotOnTable}
                    onChange={e => setMappingRow(row.rowId, { spotOnTable: e.target.value })}
                    placeholder="SpotOn Table #"
                    className="h-11 border rounded px-3 text-sm"
                  />
                  <button
                    onClick={() => removeMappingRow(row.rowId)}
                    className="h-11 px-3 rounded-lg border border-red-200 text-red-700 text-sm transition-all duration-200"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={addMappingRow}
              className="mt-3 h-11 px-3 rounded-lg border border-gray-200 text-sm transition-all duration-200"
            >
              + Add Mapping Row
            </button>

            {mappingMessage && <p className="text-sm mt-2 text-gray-700">{mappingMessage}</p>}
          </div>
        </Section>
      )}
    </div>
  );
}
