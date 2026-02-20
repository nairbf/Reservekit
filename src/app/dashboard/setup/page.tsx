"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type StepKey = 1 | 2 | 3 | 4 | 5;
type TemplateKey = "small" | "medium" | "large";

interface SetupSettings {
  restaurantName: string;
  slug: string;
  phone: string;
  address: string;
  timezone: string;
  staffNotificationEmail: string;
  contactEmail: string;
  openTime: string;
  closeTime: string;
  slotInterval: string;
  lastSeatingBufferMin: string;
  maxCoversPerSlot: string;
  maxPartySize: string;
  reserveHeading: string;
  reserveSubheading: string;
  reserveConfirmationMessage: string;
  depositEnabled: string;
  depositAmount: string;
  depositMinPartySize: string;
  depositMessage: string;
}

interface TableRow {
  id: number;
  name: string;
}

interface TutorialChecks {
  inbox: boolean;
  tonight: boolean;
  tables: boolean;
  menu: boolean;
  integrations: boolean;
  links: boolean;
  smart: boolean;
  testReservation: boolean;
}

const STEP_TITLES: Record<StepKey, string> = {
  1: "Restaurant Basics",
  2: "Operating Rules",
  3: "Table Setup",
  4: "Guest Communications",
  5: "Mini Tutorial",
};

const TIMEZONE_OPTIONS = [
  { value: "America/New_York", label: "America/New_York (Eastern)" },
  { value: "America/Chicago", label: "America/Chicago (Central)" },
  { value: "America/Denver", label: "America/Denver (Mountain)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (Pacific)" },
  { value: "America/Anchorage", label: "America/Anchorage (Alaska)" },
  { value: "Pacific/Honolulu", label: "Pacific/Honolulu (Hawaii)" },
  { value: "America/Phoenix", label: "America/Phoenix (Arizona)" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "Europe/Paris", label: "Europe/Paris" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo" },
  { value: "Australia/Sydney", label: "Australia/Sydney" },
] as const;

const DEFAULTS: SetupSettings = {
  restaurantName: "My Restaurant",
  slug: "",
  phone: "",
  address: "",
  timezone: "America/New_York",
  staffNotificationEmail: "",
  contactEmail: "",
  openTime: "17:00",
  closeTime: "22:00",
  slotInterval: "30",
  lastSeatingBufferMin: "90",
  maxCoversPerSlot: "40",
  maxPartySize: "8",
  reserveHeading: "Reserve a Table",
  reserveSubheading: "Choose your date, time, and party size.",
  reserveConfirmationMessage: "We'll contact you shortly to confirm.",
  depositEnabled: "false",
  depositAmount: "0",
  depositMinPartySize: "2",
  depositMessage: "A refundable deposit may be required to hold your table.",
};

const TEMPLATE_TABLES: Record<TemplateKey, Array<{ name: string; section: string; minCapacity: number; maxCapacity: number }>> = {
  small: [
    { name: "Table 1", section: "Main", minCapacity: 1, maxCapacity: 2 },
    { name: "Table 2", section: "Main", minCapacity: 1, maxCapacity: 2 },
    { name: "Table 3", section: "Main", minCapacity: 2, maxCapacity: 4 },
    { name: "Table 4", section: "Main", minCapacity: 2, maxCapacity: 4 },
    { name: "Table 5", section: "Main", minCapacity: 2, maxCapacity: 4 },
    { name: "Table 6", section: "Main", minCapacity: 2, maxCapacity: 4 },
    { name: "Table 7", section: "Patio", minCapacity: 2, maxCapacity: 4 },
    { name: "Table 8", section: "Patio", minCapacity: 2, maxCapacity: 6 },
  ],
  medium: [
    { name: "Table 1", section: "Main", minCapacity: 1, maxCapacity: 2 },
    { name: "Table 2", section: "Main", minCapacity: 1, maxCapacity: 2 },
    { name: "Table 3", section: "Main", minCapacity: 2, maxCapacity: 4 },
    { name: "Table 4", section: "Main", minCapacity: 2, maxCapacity: 4 },
    { name: "Table 5", section: "Main", minCapacity: 2, maxCapacity: 4 },
    { name: "Table 6", section: "Main", minCapacity: 2, maxCapacity: 4 },
    { name: "Table 7", section: "Main", minCapacity: 2, maxCapacity: 6 },
    { name: "Table 8", section: "Main", minCapacity: 2, maxCapacity: 6 },
    { name: "Table 9", section: "Patio", minCapacity: 2, maxCapacity: 4 },
    { name: "Table 10", section: "Patio", minCapacity: 2, maxCapacity: 4 },
    { name: "Table 11", section: "Patio", minCapacity: 2, maxCapacity: 6 },
    { name: "Table 12", section: "Bar", minCapacity: 1, maxCapacity: 2 },
    { name: "Table 13", section: "Bar", minCapacity: 1, maxCapacity: 2 },
    { name: "Table 14", section: "Bar", minCapacity: 2, maxCapacity: 4 },
  ],
  large: [
    { name: "Table 1", section: "Main", minCapacity: 1, maxCapacity: 2 },
    { name: "Table 2", section: "Main", minCapacity: 1, maxCapacity: 2 },
    { name: "Table 3", section: "Main", minCapacity: 2, maxCapacity: 4 },
    { name: "Table 4", section: "Main", minCapacity: 2, maxCapacity: 4 },
    { name: "Table 5", section: "Main", minCapacity: 2, maxCapacity: 4 },
    { name: "Table 6", section: "Main", minCapacity: 2, maxCapacity: 4 },
    { name: "Table 7", section: "Main", minCapacity: 2, maxCapacity: 6 },
    { name: "Table 8", section: "Main", minCapacity: 2, maxCapacity: 6 },
    { name: "Table 9", section: "Main", minCapacity: 4, maxCapacity: 8 },
    { name: "Table 10", section: "Main", minCapacity: 4, maxCapacity: 8 },
    { name: "Table 11", section: "Patio", minCapacity: 2, maxCapacity: 4 },
    { name: "Table 12", section: "Patio", minCapacity: 2, maxCapacity: 4 },
    { name: "Table 13", section: "Patio", minCapacity: 2, maxCapacity: 6 },
    { name: "Table 14", section: "Patio", minCapacity: 2, maxCapacity: 6 },
    { name: "Table 15", section: "Patio", minCapacity: 4, maxCapacity: 8 },
    { name: "Table 16", section: "Bar", minCapacity: 1, maxCapacity: 2 },
    { name: "Table 17", section: "Bar", minCapacity: 1, maxCapacity: 2 },
    { name: "Table 18", section: "Bar", minCapacity: 2, maxCapacity: 4 },
    { name: "Table 19", section: "Bar", minCapacity: 2, maxCapacity: 4 },
    { name: "Table 20", section: "Private", minCapacity: 4, maxCapacity: 8 },
    { name: "Table 21", section: "Private", minCapacity: 4, maxCapacity: 10 },
    { name: "Table 22", section: "Private", minCapacity: 6, maxCapacity: 12 },
  ],
};

function toPositiveInt(value: string, fallback: number, min: number) {
  const parsed = parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, parsed);
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        className="h-11 w-full border rounded px-3 text-sm"
      />
    </div>
  );
}

export default function SetupWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState<StepKey>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [settings, setSettings] = useState<SetupSettings>(DEFAULTS);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKey>("medium");
  const [tutorial, setTutorial] = useState<TutorialChecks>({
    inbox: false,
    tonight: false,
    tables: false,
    menu: false,
    integrations: false,
    links: false,
    smart: false,
    testReservation: false,
  });

  const tutorialDoneCount = useMemo(() => Object.values(tutorial).filter(Boolean).length, [tutorial]);
  const reservationTestUrl = useMemo(() => {
    const slug = String(settings.slug || "").trim();
    if (typeof window === "undefined") {
      return slug ? `/reserve/${slug}` : "/";
    }
    return slug ? `${window.location.origin}/reserve/${slug}` : `${window.location.origin}/`;
  }, [settings.slug]);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings/public").then(r => r.json()),
      fetch("/api/tables").then(r => r.json()),
    ])
      .then(([loadedSettings, loadedTables]) => {
        const completed = loadedSettings.setupWizardCompleted === "true";
        if (completed) {
          router.replace("/dashboard");
          return;
        }
        const loadedStep = parseInt(String(loadedSettings.setupWizardStep || "1"), 10);
        if (Number.isFinite(loadedStep) && loadedStep >= 1 && loadedStep <= 5) setStep(loadedStep as StepKey);
        const mergedSettings = {
          ...loadedSettings,
          depositEnabled: String(loadedSettings.depositEnabled || loadedSettings.depositsEnabled || DEFAULTS.depositEnabled),
          depositMinPartySize: String(loadedSettings.depositMinPartySize || loadedSettings.depositMinParty || DEFAULTS.depositMinPartySize),
        };
        setSettings({
          ...DEFAULTS,
          ...Object.fromEntries(Object.entries(mergedSettings).map(([k, v]) => [k, String(v)])),
        });
        setTables(Array.isArray(loadedTables) ? loadedTables : []);
      })
      .finally(() => setLoading(false));
  }, [router]);

  function setField<K extends keyof SetupSettings>(key: K, value: SetupSettings[K]) {
    setSettings(prev => ({ ...prev, [key]: value }));
    setMessage("");
  }

  async function saveSettings(payload: Partial<SetupSettings> & Record<string, string>) {
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  async function goTo(next: StepKey) {
    setStep(next);
    await saveSettings({ setupWizardStep: String(next) });
  }

  async function saveStepOne() {
    if (!settings.restaurantName.trim()) {
      setMessage("Restaurant name is required.");
      return;
    }
    setSaving(true);
    try {
      const notificationEmail = settings.staffNotificationEmail.trim();
      await saveSettings({
        restaurantName: settings.restaurantName.trim(),
        phone: settings.phone.trim(),
        address: settings.address.trim(),
        timezone: settings.timezone.trim() || "America/New_York",
        staffNotificationEmail: notificationEmail,
        contactEmail: settings.contactEmail.trim(),
        replyToEmail: notificationEmail,
        staffNotificationsEnabled: "true",
        emailEnabled: "true",
        emailSendConfirmations: "true",
        emailSendReminders: "true",
        setupWizardStep: "2",
      });
      setMessage("Restaurant basics saved.");
      await goTo(2);
    } finally {
      setSaving(false);
    }
  }

  async function saveStepTwo() {
    const openTime = settings.openTime || "17:00";
    const closeTime = settings.closeTime || "22:00";
    if (openTime >= closeTime) {
      setMessage("Close time should be later than open time.");
      return;
    }
    const slotInterval = toPositiveInt(settings.slotInterval, 30, 5);
    const lastSeatingBufferMin = toPositiveInt(settings.lastSeatingBufferMin, 90, 0);
    const maxCoversPerSlot = toPositiveInt(settings.maxCoversPerSlot, 40, 1);
    const maxPartySize = toPositiveInt(settings.maxPartySize, 8, 1);

    setSaving(true);
    try {
      await saveSettings({
        openTime,
        closeTime,
        slotInterval: String(slotInterval),
        lastSeatingBufferMin: String(lastSeatingBufferMin),
        maxCoversPerSlot: String(maxCoversPerSlot),
        maxPartySize: String(maxPartySize),
        setupWizardStep: "3",
      });
      setSettings(prev => ({
        ...prev,
        slotInterval: String(slotInterval),
        lastSeatingBufferMin: String(lastSeatingBufferMin),
        maxCoversPerSlot: String(maxCoversPerSlot),
        maxPartySize: String(maxPartySize),
      }));
      setMessage("Operating rules saved.");
      await goTo(3);
    } finally {
      setSaving(false);
    }
  }

  function makeUniqueName(base: string, existing: Set<string>): string {
    if (!existing.has(base)) return base;
    let i = 2;
    while (existing.has(`${base} (${i})`)) i += 1;
    return `${base} (${i})`;
  }

  async function applyTemplate() {
    setSaving(true);
    setMessage("");
    try {
      const existingNames = new Set(tables.map(t => t.name));
      const toCreate = TEMPLATE_TABLES[selectedTemplate].map((table, index) => ({
        ...table,
        name: makeUniqueName(table.name, existingNames),
        sortOrder: tables.length + index + 1,
      }));
      for (const table of toCreate) {
        existingNames.add(table.name);
      }

      await Promise.all(
        toCreate.map(table =>
          fetch("/api/tables", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(table),
          }),
        ),
      );
      const refreshedTables = await (await fetch("/api/tables")).json();
      setTables(Array.isArray(refreshedTables) ? refreshedTables : []);
      setMessage(`Added ${toCreate.length} starter tables.`);
    } finally {
      setSaving(false);
    }
  }

  async function nextFromTables() {
    setSaving(true);
    try {
      await saveSettings({ setupWizardStep: "4" });
      await goTo(4);
    } finally {
      setSaving(false);
    }
  }

  async function saveStepFour() {
    const depositAmount = Math.max(0, Number(settings.depositAmount || "0"));
    const depositMinPartySize = Math.max(1, Number(settings.depositMinPartySize || "2"));
    setSaving(true);
    try {
      await saveSettings({
        reserveHeading: settings.reserveHeading.trim() || DEFAULTS.reserveHeading,
        reserveSubheading: settings.reserveSubheading.trim() || DEFAULTS.reserveSubheading,
        reserveConfirmationMessage: settings.reserveConfirmationMessage.trim() || DEFAULTS.reserveConfirmationMessage,
        depositEnabled: settings.depositEnabled === "true" ? "true" : "false",
        depositAmount: String(depositAmount),
        depositMinPartySize: String(depositMinPartySize),
        depositMessage: settings.depositMessage.trim() || DEFAULTS.depositMessage,
        setupWizardStep: "5",
      });
      setSettings(prev => ({
        ...prev,
        depositAmount: String(depositAmount),
        depositMinPartySize: String(depositMinPartySize),
      }));
      setMessage("Guest communication settings saved.");
      await goTo(5);
    } finally {
      setSaving(false);
    }
  }

  async function completeSetup() {
    setSaving(true);
    try {
      await saveSettings({
        setupWizardCompleted: "true",
        setupWizardCompletedAt: new Date().toISOString(),
        setupWizardStep: "5",
      });
      router.replace("/dashboard");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-gray-500">
        <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
        Loading setup wizard...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="bg-white rounded-xl border p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">First-Time Setup Wizard</h1>
            <p className="text-sm text-gray-500">Step {step} of 5: {STEP_TITLES[step]}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {[1, 2, 3, 4, 5].map(idx => (
              <span key={idx} className={`h-2.5 w-10 rounded-full ${idx <= step ? "bg-blue-600" : "bg-gray-200"}`} />
            ))}
          </div>
        </div>
      </div>

      {message && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">
          {message}
        </div>
      )}

      {step === 1 && (
        <div className="bg-white rounded-xl border p-4 sm:p-6 space-y-4">
          <h2 className="font-semibold text-lg">Restaurant Basics</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Restaurant Name" value={settings.restaurantName} onChange={v => setField("restaurantName", v)} />
            <Field label="Phone" value={settings.phone} onChange={v => setField("phone", v)} placeholder="(555) 123-4567" />
            <Field
              label="Notification Email"
              value={settings.staffNotificationEmail}
              onChange={v => setField("staffNotificationEmail", v)}
              placeholder="alerts@restaurant.com"
              type="email"
            />
            <Field
              label="Contact Email"
              value={settings.contactEmail}
              onChange={v => setField("contactEmail", v)}
              placeholder="hello@restaurant.com"
              type="email"
            />
            <div className="sm:col-span-2">
              <Field label="Address" value={settings.address} onChange={v => setField("address", v)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Timezone</label>
              <select
                value={settings.timezone}
                onChange={e => setField("timezone", e.target.value)}
                className="h-11 w-full border rounded px-3 text-sm"
              >
                {TIMEZONE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button disabled={saving} onClick={saveStepOne} className="h-11 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium transition-all duration-200 disabled:opacity-60">
              {saving ? "Saving..." : "Save & Continue"}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-white rounded-xl border p-4 sm:p-6 space-y-4">
          <h2 className="font-semibold text-lg">Operating Rules</h2>
          <p className="text-sm text-gray-500">Set defaults for availability and booking limits. You can fine-tune by day in Schedule later.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Open Time" type="time" value={settings.openTime} onChange={v => setField("openTime", v)} />
            <Field label="Close Time" type="time" value={settings.closeTime} onChange={v => setField("closeTime", v)} />
            <Field label="Slot Interval (minutes)" type="number" value={settings.slotInterval} onChange={v => setField("slotInterval", v)} />
            <Field label="Last Seating Buffer (minutes)" type="number" value={settings.lastSeatingBufferMin} onChange={v => setField("lastSeatingBufferMin", v)} />
            <Field label="Max Covers Per Slot" type="number" value={settings.maxCoversPerSlot} onChange={v => setField("maxCoversPerSlot", v)} />
            <Field label="Max Party Size" type="number" value={settings.maxPartySize} onChange={v => setField("maxPartySize", v)} />
          </div>
          <div className="flex justify-between">
            <button disabled={saving} onClick={() => goTo(1)} className="h-11 px-4 rounded-lg border border-gray-200 text-sm transition-all duration-200">Back</button>
            <button disabled={saving} onClick={saveStepTwo} className="h-11 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium transition-all duration-200 disabled:opacity-60">
              {saving ? "Saving..." : "Save & Continue"}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="bg-white rounded-xl border p-4 sm:p-6 space-y-4">
          <h2 className="font-semibold text-lg">Table Setup</h2>
          <p className="text-sm text-gray-500">Current table count: <strong>{tables.length}</strong>. Add a starter template now, then edit details in Tables/Floor Plan.</p>
          <div className="grid sm:grid-cols-3 gap-3">
            <button onClick={() => setSelectedTemplate("small")} className={`h-11 rounded-lg border text-sm transition-all duration-200 ${selectedTemplate === "small" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200"}`}>Small (8 tables)</button>
            <button onClick={() => setSelectedTemplate("medium")} className={`h-11 rounded-lg border text-sm transition-all duration-200 ${selectedTemplate === "medium" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200"}`}>Medium (14 tables)</button>
            <button onClick={() => setSelectedTemplate("large")} className={`h-11 rounded-lg border text-sm transition-all duration-200 ${selectedTemplate === "large" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200"}`}>Large (22 tables)</button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button disabled={saving} onClick={applyTemplate} className="h-11 px-4 rounded-lg bg-gray-900 text-white text-sm transition-all duration-200 disabled:opacity-60">
              {saving ? "Adding..." : "Add Starter Tables"}
            </button>
            <Link href="/dashboard/tables?fromSetup=1&tour=tables" className="h-11 px-4 rounded-lg border border-gray-200 text-sm flex items-center">Open Tables Page</Link>
            <Link href="/dashboard/floorplan?fromSetup=1&tour=floorplan" className="h-11 px-4 rounded-lg border border-gray-200 text-sm flex items-center">Open Floor Plan</Link>
          </div>
          <div className="flex justify-between">
            <button disabled={saving} onClick={() => goTo(2)} className="h-11 px-4 rounded-lg border border-gray-200 text-sm transition-all duration-200">Back</button>
            <button disabled={saving} onClick={nextFromTables} className="h-11 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium transition-all duration-200 disabled:opacity-60">
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="bg-white rounded-xl border p-4 sm:p-6 space-y-4">
          <h2 className="font-semibold text-lg">Guest Communications</h2>
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <div className="font-medium">Email Notifications</div>
            <p className="mt-1">
              Confirmation and reminder emails are sent automatically when guests make reservations. No setup needed — emails are handled by our platform.
            </p>
            <p className="mt-1">
              You can customize email templates in Settings {"->"} Email Templates after setup.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Reserve Heading" value={settings.reserveHeading} onChange={v => setField("reserveHeading", v)} />
            <Field label="Reserve Subheading" value={settings.reserveSubheading} onChange={v => setField("reserveSubheading", v)} />
            <div className="sm:col-span-2">
              <Field label="Confirmation Message" value={settings.reserveConfirmationMessage} onChange={v => setField("reserveConfirmationMessage", v)} />
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 p-3 space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={settings.depositEnabled === "true"} onChange={e => setField("depositEnabled", e.target.checked ? "true" : "false")} className="h-4 w-4" />
              Enable deposits by default
            </label>
            {settings.depositEnabled === "true" && (
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Deposit Amount (USD)" type="number" value={settings.depositAmount} onChange={v => setField("depositAmount", v)} />
                <Field label="Apply at Party Size" type="number" value={settings.depositMinPartySize} onChange={v => setField("depositMinPartySize", v)} />
                <div className="sm:col-span-2">
                  <Field label="Deposit Message" value={settings.depositMessage} onChange={v => setField("depositMessage", v)} />
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-between">
            <button disabled={saving} onClick={() => goTo(3)} className="h-11 px-4 rounded-lg border border-gray-200 text-sm transition-all duration-200">Back</button>
            <button disabled={saving} onClick={saveStepFour} className="h-11 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium transition-all duration-200 disabled:opacity-60">
              {saving ? "Saving..." : "Save & Continue"}
            </button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="bg-white rounded-xl border p-4 sm:p-6 space-y-4">
          <h2 className="font-semibold text-lg">Mini Tutorial</h2>
          <p className="text-sm text-gray-500">Follow this quick launch sequence. Mark each item done as you complete it.</p>

          <div className="space-y-2">
            <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <span className="text-sm">Review pending requests in Inbox</span>
              <div className="flex items-center gap-2">
                <Link href="/dashboard" className="text-xs text-blue-600">Open</Link>
                <input type="checkbox" checked={tutorial.inbox} onChange={e => setTutorial(prev => ({ ...prev, inbox: e.target.checked }))} className="h-4 w-4" />
              </div>
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <span className="text-sm">Practice the service flow on Tonight (Arrive {"->"} Seat {"->"} Complete)</span>
              <div className="flex items-center gap-2">
                <Link href="/dashboard/tonight" className="text-xs text-blue-600">Open</Link>
                <input type="checkbox" checked={tutorial.tonight} onChange={e => setTutorial(prev => ({ ...prev, tonight: e.target.checked }))} className="h-4 w-4" />
              </div>
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <span className="text-sm">Verify table capacities and floor plan layout</span>
              <div className="flex items-center gap-2">
                <Link href="/dashboard/floorplan" className="text-xs text-blue-600">Open</Link>
                <input type="checkbox" checked={tutorial.tables} onChange={e => setTutorial(prev => ({ ...prev, tables: e.target.checked }))} className="h-4 w-4" />
              </div>
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <span className="text-sm">Add your menu (manually or sync from POS)</span>
              <div className="flex items-center gap-2">
                <Link href="/dashboard/menu" className="text-xs text-blue-600">Open</Link>
                <input type="checkbox" checked={tutorial.menu} onChange={e => setTutorial(prev => ({ ...prev, menu: e.target.checked }))} className="h-4 w-4" />
              </div>
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <span className="text-sm">Connect integrations (Stripe, SpotOn POS)</span>
              <div className="flex items-center gap-2">
                <Link href="/dashboard/settings?tab=integrations" className="text-xs text-blue-600">Open</Link>
                <input type="checkbox" checked={tutorial.integrations} onChange={e => setTutorial(prev => ({ ...prev, integrations: e.target.checked }))} className="h-4 w-4" />
              </div>
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <span className="text-sm">Grab your embed code and links</span>
              <div className="flex items-center gap-2">
                <Link href="/dashboard/settings?tab=links" className="text-xs text-blue-600">Open</Link>
                <input type="checkbox" checked={tutorial.links} onChange={e => setTutorial(prev => ({ ...prev, links: e.target.checked }))} className="h-4 w-4" />
              </div>
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <span className="text-sm">Review Smart Features</span>
              <div className="flex items-center gap-2">
                <Link href="/dashboard/settings?tab=smart" className="text-xs text-blue-600">Open</Link>
                <input type="checkbox" checked={tutorial.smart} onChange={e => setTutorial(prev => ({ ...prev, smart: e.target.checked }))} className="h-4 w-4" />
              </div>
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <span className="text-sm">Test a real reservation from your website</span>
              <div className="flex items-center gap-2">
                <Link href={reservationTestUrl} className="text-xs text-blue-600" target={reservationTestUrl.startsWith("http") ? "_blank" : undefined} rel={reservationTestUrl.startsWith("http") ? "noopener noreferrer" : undefined}>Open</Link>
                <input type="checkbox" checked={tutorial.testReservation} onChange={e => setTutorial(prev => ({ ...prev, testReservation: e.target.checked }))} className="h-4 w-4" />
              </div>
            </label>
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">
            Tutorial progress: {tutorialDoneCount}/8 steps complete — you can always come back to this later.
          </div>

          <div className="text-xs text-gray-500">
            Don&apos;t worry about completing everything now. You can access all of these from your dashboard at any time.
          </div>

          <div className="flex justify-between">
            <button disabled={saving} onClick={() => goTo(4)} className="h-11 px-4 rounded-lg border border-gray-200 text-sm transition-all duration-200">Back</button>
            <button disabled={saving} onClick={completeSetup} className="h-11 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium transition-all duration-200 disabled:opacity-60">
              {saving ? "Finishing..." : "Finish Setup"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
