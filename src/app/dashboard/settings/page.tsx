"use client";
import { useEffect, useState } from "react";

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
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tables, setTables] = useState<TableItem[]>([]);
  const [mappingRows, setMappingRows] = useState<MappingRow[]>([{ rowId: makeRowId(), reservekitTableId: "", spotOnTable: "" }]);
  const [mappingMessage, setMappingMessage] = useState<string>("");
  const [spotOnStatus, setSpotOnStatus] = useState<SpotOnStatus>({ licensed: true, configured: false, spotonLastSync: null, openChecks: 0 });
  const [spotOnMessage, setSpotOnMessage] = useState<string>("");
  const [testingConnection, setTestingConnection] = useState(false);
  const [syncingSpotOn, setSyncingSpotOn] = useState(false);
  const [savingMapping, setSavingMapping] = useState(false);

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
          <p className="text-gray-500 text-sm">General configuration, email, SMS, and POS</p>
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

      <Section title="SpotOn POS Integration">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="POS License Key" value={settings.license_pos} onChange={v => set("license_pos", v)} placeholder="RK-POS-XXXXXXXX" />
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
                  <option value="">ReserveKit Table</option>
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

      <Section title="Widget Embed Code">
        <p className="text-sm text-gray-600 mb-2">Paste this on your restaurant website:</p>
        <div className="bg-gray-100 rounded-lg p-3 text-xs font-mono break-all select-all">
          {`<script data-reservekit src="${typeof window !== "undefined" ? window.location.origin : "https://your-domain.com"}/widget.js"></script>`}
        </div>
      </Section>
    </div>
  );
}
