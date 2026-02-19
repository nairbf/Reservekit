"use client";

import { useEffect, useMemo, useState } from "react";
import AccessDenied from "@/components/access-denied";
import LandingBuilder from "@/components/landing-builder";
import { useHasPermission } from "@/hooks/use-permissions";

type SettingsTab = "restaurant" | "reservations" | "notifications" | "integrations" | "license";

type SettingsMap = Record<string, string>;
type TemplateField = "subject" | "heading" | "body" | "ctaText" | "ctaUrl" | "footerText";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  heading: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
  footerText: string;
  customized: boolean;
}

type PosProvider = "square" | "toast" | "clover";

interface PosSyncStatus {
  provider: PosProvider | null;
  connected: boolean;
  lastSync: string | null;
  locationName: string | null;
  error: string | null;
  counts: {
    menuItems: number;
    tables: number;
    businessHours: number;
  };
  credentialsPresent: Record<PosProvider, boolean>;
  availability: Record<PosProvider, boolean>;
}

interface SpotOnStatus {
  licensed: boolean;
  configured: boolean;
  spotonLastSync: string | null;
  openChecks: number;
}

interface SpotOnTableItem {
  id: number;
  name: string;
}

interface SpotOnMappingRow {
  rowId: string;
  reservekitTableId: number | "";
  spotOnTable: string;
}

const TEMPLATE_VARIABLES = [
  "{{restaurantName}}",
  "{{restaurantPhone}}",
  "{{restaurantEmail}}",
  "{{restaurantAddress}}",
  "{{guestName}}",
  "{{guestEmail}}",
  "{{guestPhone}}",
  "{{date}}",
  "{{time}}",
  "{{partySize}}",
  "{{confirmationCode}}",
  "{{manageUrl}}",
  "{{reserveUrl}}",
  "{{estimatedWait}}",
  "{{position}}",
  "{{eventName}}",
  "{{eventDate}}",
  "{{eventTime}}",
  "{{ticketCount}}",
  "{{ticketTotal}}",
  "{{ticketUrl}}",
  "{{ticketCodes}}",
  "{{resetUrl}}",
  "{{userName}}",
];

const TABS: Array<{ key: SettingsTab; label: string; description: string }> = [
  { key: "restaurant", label: "Restaurant", description: "Branding, homepage, and contact details" },
  { key: "reservations", label: "Reservations", description: "Booking rules, deposits, and cutoffs" },
  { key: "notifications", label: "Notifications", description: "Email, reminders, and staff alerts" },
  { key: "integrations", label: "Integrations", description: "Connect POS systems and sync data" },
  { key: "license", label: "License", description: "Read-only plan and feature status" },
];

const FEATURE_ROWS = [
  { key: "feature_sms", label: "SMS Notifications" },
  { key: "feature_floorplan", label: "Visual Floor Plan" },
  { key: "feature_reporting", label: "Reporting Dashboard" },
  { key: "feature_guest_history", label: "Guest History" },
  { key: "feature_event_ticketing", label: "Event Ticketing" },
];

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
  { value: "Europe/Berlin", label: "Europe/Berlin" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo" },
  { value: "Asia/Shanghai", label: "Asia/Shanghai" },
  { value: "Australia/Sydney", label: "Australia/Sydney" },
];

const POS_PROVIDERS: Array<{
  key: PosProvider;
  name: string;
  icon: string;
  description: string;
}> = [
  { key: "square", name: "Square", icon: "🟩", description: "Sync menu items and business hours from Square." },
  { key: "toast", name: "Toast", icon: "🍞", description: "Sync menu, tables, and hours from Toast." },
  { key: "clover", name: "Clover", icon: "🍀", description: "Sync menu, tables, and hours from Clover." },
];

const SETTINGS_WRITE_KEYS = new Set([
  "restaurantName",
  "slug",
  "tagline",
  "description",
  "accentColor",
  "logoUrl",
  "heroImageUrl",
  "faviconUrl",
  "phone",
  "address",
  "contactEmail",
  "landing_sections",
  "timezone",
  "openTime",
  "closeTime",
  "slotInterval",
  "lastSeatingBufferMin",
  "maxCoversPerSlot",
  "maxPartySize",
  "diningDurations",
  "weeklySchedule",
  "bookingLeadHours",
  "defaultPartySizes",
  "reservationApprovalMode",
  "cancellationPolicy",
  "selfServiceCutoffHours",
  "depositEnabled",
  "depositsEnabled",
  "depositType",
  "depositAmount",
  "depositMinParty",
  "depositMinPartySize",
  "depositMessage",
  "specialDepositRules",
  "noshowChargeEnabled",
  "noshowChargeAmount",
  "emailEnabled",
  "emailSendConfirmations",
  "emailSendReminders",
  "emailSendWaitlist",
  "emailReminderTiming",
  "reminderLeadHours",
  "emailReplyTo",
  "replyToEmail",
  "emailStaffNotification",
  "staffNotificationEmail",
  "staffNotificationsEnabled",
  "largePartyThreshold",
  "twilioSid",
  "twilioToken",
  "twilioPhone",
  "loyaltyOptInEnabled",
  "loyaltyProgramName",
  "loyaltyOptInMessage",
  "loyaltyOptInLabel",
  "expressDiningEnabled",
  "expressDiningMode",
  "expressDiningPayment",
  "expressDiningCutoffHours",
  "expressDiningMessage",
  "spotonApiKey",
  "spotonLocationId",
  "spotonEnvironment",
  "spotonUseMock",
  "reserveHeading",
  "reserveSubheading",
  "reserveConfirmationMessage",
  "setupWizardStep",
  "setupWizardCompleted",
  "setupWizardCompletedAt",
]);

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

function currentTimeInTimezone(timezone: string, nowMs: number): string {
  try {
    return new Date(nowMs).toLocaleTimeString("en-US", {
      timeZone: timezone || "America/New_York",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return "Unavailable";
  }
}

function makeSpotOnMappingRowId() {
  return `spoton-map-${Math.random().toString(36).slice(2, 10)}`;
}

export default function SettingsPage() {
  const canManageSettings = useHasPermission("manage_settings");
  const [activeTab, setActiveTab] = useState<SettingsTab>("restaurant");
  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [licenseBusy, setLicenseBusy] = useState(false);
  const [licenseMessage, setLicenseMessage] = useState("");
  const [showLicenseKey, setShowLicenseKey] = useState(false);
  const [templates, setTemplates] = useState<Record<string, EmailTemplate>>({});
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateExpanded, setTemplateExpanded] = useState<string | null>(null);
  const [templateSaving, setTemplateSaving] = useState<string | null>(null);
  const [templateTesting, setTemplateTesting] = useState<string | null>(null);
  const [templateMessage, setTemplateMessage] = useState<Record<string, string>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [previewData, setPreviewData] = useState<{ templateId: string; subject: string; html: string } | null>(null);
  const [posStatus, setPosStatus] = useState<PosSyncStatus | null>(null);
  const [posLoading, setPosLoading] = useState(false);
  const [posBusy, setPosBusy] = useState<PosProvider | null>(null);
  const [posMessage, setPosMessage] = useState("");
  const [spotOnStatus, setSpotOnStatus] = useState<SpotOnStatus>({
    licensed: true,
    configured: false,
    spotonLastSync: null,
    openChecks: 0,
  });
  const [spotOnExpanded, setSpotOnExpanded] = useState(false);
  const [spotOnLoading, setSpotOnLoading] = useState(false);
  const [spotOnMessage, setSpotOnMessage] = useState("");
  const [spotOnSyncing, setSpotOnSyncing] = useState(false);
  const [spotOnSaving, setSpotOnSaving] = useState(false);
  const [spotOnMappingOpen, setSpotOnMappingOpen] = useState(false);
  const [spotOnMappingBusy, setSpotOnMappingBusy] = useState(false);
  const [spotOnMappingMessage, setSpotOnMappingMessage] = useState("");
  const [spotOnTables, setSpotOnTables] = useState<SpotOnTableItem[]>([]);
  const [spotOnMappingRows, setSpotOnMappingRows] = useState<SpotOnMappingRow[]>([
    { rowId: makeSpotOnMappingRowId(), reservekitTableId: "", spotOnTable: "" },
  ]);
  const [showStripeSecretKey, setShowStripeSecretKey] = useState(false);
  const [stripeTestStatus, setStripeTestStatus] = useState<"idle" | "testing" | "connected" | "invalid">("idle");
  const [stripeTestMessage, setStripeTestMessage] = useState("");
  const [stripeOAuthMessage, setStripeOAuthMessage] = useState("");
  const [stripeOAuthError, setStripeOAuthError] = useState(false);
  const [stripeDisconnecting, setStripeDisconnecting] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [testRecipient, setTestRecipient] = useState("");
  const [clockMs, setClockMs] = useState(() => Date.now());

  const smsEnabled = settings.feature_sms === "true";

  async function loadSettings() {
    const response = await fetch("/api/settings");
    const data = (await response.json()) as SettingsMap;
    setSettings(data);
  }

  async function loadCurrentUserEmail() {
    try {
      const response = await fetch("/api/auth/me");
      if (!response.ok) return;
      const data = (await response.json()) as { email?: string };
      const email = String(data.email || "");
      setCurrentUserEmail(email);
      setTestRecipient((previous) => previous || email);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadCurrentUserEmail().catch(() => undefined);
    loadSettings()
      .catch(() => setSettings({}))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedTab = params.get("tab");
    if (requestedTab === "restaurant" || requestedTab === "reservations" || requestedTab === "notifications" || requestedTab === "integrations" || requestedTab === "license") {
      setActiveTab(requestedTab);
    }
    if (params.get("connected") === "true") {
      setPosMessage("POS provider connected.");
    }
    const error = params.get("error");
    if (error) setPosMessage(error);

    if (params.get("stripe_connected") === "true") {
      setActiveTab("reservations");
      setStripeOAuthError(false);
      setStripeOAuthMessage("Stripe account connected successfully.");
      setStripeTestStatus("connected");
    }
    const stripeError = params.get("stripe_error");
    if (stripeError) {
      setActiveTab("reservations");
      setStripeOAuthError(true);
      setStripeOAuthMessage(stripeError);
      setStripeTestStatus("invalid");
    }
  }, []);

  useEffect(() => {
    if (activeTab !== "notifications") return;
    if (templateLoading || Object.keys(templates).length > 0) return;
    loadTemplates().catch(() => undefined);
  }, [activeTab, templateLoading, templates]);

  useEffect(() => {
    if (activeTab !== "integrations") return;
    loadPosStatus().catch(() => undefined);
    loadSpotOnStatus().catch(() => undefined);
    loadSpotOnMapping().catch(() => undefined);
  }, [activeTab]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockMs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  function setField(key: string, value: string) {
    setSettings((previous) => ({ ...previous, [key]: value }));
    if (key === "stripePublishableKey" || key === "stripeSecretKey" || key === "stripeWebhookSecret") {
      setStripeTestStatus("idle");
      setStripeTestMessage("");
    }
    setSaved(false);
  }

  async function saveChanges() {
    setSaving(true);
    setSaveError("");
    try {
      const payload: Record<string, string> = {};
      for (const [key, value] of Object.entries(settings)) {
        if (!SETTINGS_WRITE_KEYS.has(key)) continue;
        payload[key] = String(value ?? "");
      }

      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Failed to save settings.");
      }
      await loadSettings();
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function savePartial(patch: Record<string, string>) {
    const filtered = Object.fromEntries(
      Object.entries(patch)
        .filter(([key]) => SETTINGS_WRITE_KEYS.has(key))
        .map(([key, value]) => [key, String(value ?? "")]),
    ) as Record<string, string>;
    if (Object.keys(filtered).length === 0) return;

    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(filtered),
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error || "Failed to save settings.");
    }
    setSettings((previous) => ({ ...previous, ...filtered }));
  }

  async function loadTemplates() {
    setTemplateLoading(true);
    try {
      const response = await fetch("/api/email-templates");
      if (!response.ok) throw new Error("Failed to load templates");
      const data = await response.json();
      const incoming = (data?.templates || {}) as Record<string, EmailTemplate>;
      setTemplates(incoming);
      if (!templateExpanded) {
        const first = Object.keys(incoming)[0];
        if (first) setTemplateExpanded(first);
      }
      setTemplateMessage((previous) => ({ ...previous, __global: "" }));
    } catch {
      setTemplateMessage((previous) => ({ ...previous, __global: "Could not load templates." }));
    } finally {
      setTemplateLoading(false);
    }
  }

  async function loadPosStatus() {
    setPosLoading(true);
    try {
      const response = await fetch("/api/pos/sync");
      const data = (await response.json().catch(() => ({}))) as PosSyncStatus;
      if (!response.ok) throw new Error((data as { error?: string })?.error || "Could not load integrations.");
      setPosStatus(data);
    } catch (error) {
      setPosStatus(null);
      setPosMessage(error instanceof Error ? error.message : "Could not load integrations.");
    } finally {
      setPosLoading(false);
    }
  }

  async function loadSpotOnStatus() {
    setSpotOnLoading(true);
    try {
      const response = await fetch("/api/spoton/sync");
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        licensed?: boolean;
        configured?: boolean;
        spotonLastSync?: string | null;
        openChecks?: number;
      };

      if (!response.ok) {
        setSpotOnStatus((previous) => ({
          ...previous,
          licensed: data.licensed !== false,
          configured: Boolean((settings.spotonApiKey || "").trim() && (settings.spotonLocationId || "").trim()),
          spotonLastSync: data.spotonLastSync || previous.spotonLastSync,
          openChecks: Number(data.openChecks || 0),
        }));
        if (data.error) setSpotOnMessage(data.error);
        return;
      }

      setSpotOnStatus({
        licensed: data.licensed !== false,
        configured: Boolean(data.configured),
        spotonLastSync: data.spotonLastSync || null,
        openChecks: Number(data.openChecks || 0),
      });
    } catch (error) {
      setSpotOnMessage(error instanceof Error ? error.message : "Could not load SpotOn status.");
    } finally {
      setSpotOnLoading(false);
    }
  }

  async function loadSpotOnMapping() {
    try {
      const response = await fetch("/api/spoton/mapping");
      if (!response.ok) return;
      const data = (await response.json().catch(() => ({}))) as {
        tables?: SpotOnTableItem[];
        mappings?: Array<{ reservekitTableId: number; spotOnTable: string }>;
      };
      setSpotOnTables(Array.isArray(data.tables) ? data.tables : []);
      if (Array.isArray(data.mappings) && data.mappings.length > 0) {
        setSpotOnMappingRows(
          data.mappings.map((row) => ({
            rowId: makeSpotOnMappingRowId(),
            reservekitTableId: row.reservekitTableId,
            spotOnTable: row.spotOnTable || "",
          })),
        );
      } else {
        setSpotOnMappingRows([{ rowId: makeSpotOnMappingRowId(), reservekitTableId: "", spotOnTable: "" }]);
      }
    } catch {
      // ignore
    }
  }

  async function saveSpotOnConfig() {
    setSpotOnSaving(true);
    setSpotOnMessage("");
    try {
      const patch = {
        spotonApiKey: (settings.spotonApiKey || "").trim(),
        spotonLocationId: (settings.spotonLocationId || "").trim(),
        spotonUseMock: settings.spotonUseMock === "true" ? "true" : "false",
      };
      await savePartial(patch);
      setSpotOnMessage("SpotOn settings saved.");
      await loadSpotOnStatus();
    } catch (error) {
      setSpotOnMessage(error instanceof Error ? error.message : "Failed to save SpotOn settings.");
    } finally {
      setSpotOnSaving(false);
    }
  }

  async function syncSpotOnNow() {
    setSpotOnSyncing(true);
    setSpotOnMessage("");
    try {
      const response = await fetch("/api/spoton/sync", { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        timestamp?: string;
        openChecks?: number | unknown[];
      };
      if (!response.ok || !data.success) throw new Error(data.error || "SpotOn sync failed.");
      const openChecksCount = Array.isArray(data.openChecks) ? data.openChecks.length : Number(data.openChecks || 0);
      setSpotOnStatus((previous) => ({
        ...previous,
        configured: true,
        spotonLastSync: data.timestamp || new Date().toISOString(),
        openChecks: openChecksCount,
      }));
      setSpotOnMessage(`Sync complete. ${openChecksCount} open checks.`);
    } catch (error) {
      setSpotOnMessage(error instanceof Error ? error.message : "SpotOn sync failed.");
    } finally {
      setSpotOnSyncing(false);
    }
  }

  async function disconnectSpotOn() {
    if (!confirm("Disconnect SpotOn?")) return;
    setSpotOnSaving(true);
    setSpotOnMessage("");
    try {
      await savePartial({
        spotonApiKey: "",
        spotonLocationId: "",
        spotonUseMock: "false",
      });
      setSpotOnStatus({
        licensed: spotOnStatus.licensed,
        configured: false,
        spotonLastSync: null,
        openChecks: 0,
      });
      setSpotOnExpanded(false);
      setSpotOnMappingOpen(false);
      setSpotOnMessage("SpotOn disconnected.");
    } catch (error) {
      setSpotOnMessage(error instanceof Error ? error.message : "Failed to disconnect SpotOn.");
    } finally {
      setSpotOnSaving(false);
    }
  }

  function setSpotOnMappingRow(rowId: string, patch: Partial<SpotOnMappingRow>) {
    setSpotOnMappingRows((rows) => rows.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)));
  }

  function addSpotOnMappingRow() {
    setSpotOnMappingRows((rows) => [...rows, { rowId: makeSpotOnMappingRowId(), reservekitTableId: "", spotOnTable: "" }]);
  }

  function removeSpotOnMappingRow(rowId: string) {
    setSpotOnMappingRows((rows) => {
      const next = rows.filter((row) => row.rowId !== rowId);
      return next.length > 0 ? next : [{ rowId: makeSpotOnMappingRowId(), reservekitTableId: "", spotOnTable: "" }];
    });
  }

  async function autoMatchSpotOnTables() {
    setSpotOnMappingBusy(true);
    setSpotOnMappingMessage("");
    try {
      const response = await fetch("/api/spoton/mapping", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "auto" }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        count?: number;
        matches?: Array<{ reservekitTableId: number; spotOnTable: string }>;
      };
      if (!response.ok) throw new Error(data.error || "Auto-match failed.");
      const matches = Array.isArray(data.matches) ? data.matches : [];
      setSpotOnMappingRows(
        matches.length > 0
          ? matches.map((row) => ({
              rowId: makeSpotOnMappingRowId(),
              reservekitTableId: row.reservekitTableId,
              spotOnTable: row.spotOnTable || "",
            }))
          : [{ rowId: makeSpotOnMappingRowId(), reservekitTableId: "", spotOnTable: "" }],
      );
      setSpotOnMappingMessage(`Auto-matched ${Number(data.count || matches.length)} table(s).`);
    } catch (error) {
      setSpotOnMappingMessage(error instanceof Error ? error.message : "Auto-match failed.");
    } finally {
      setSpotOnMappingBusy(false);
    }
  }

  async function saveSpotOnMapping() {
    setSpotOnMappingBusy(true);
    setSpotOnMappingMessage("");
    try {
      const mappings = spotOnMappingRows
        .filter((row) => row.reservekitTableId !== "" && row.spotOnTable.trim())
        .map((row) => ({
          reservekitTableId: Number(row.reservekitTableId),
          spotOnTable: row.spotOnTable.trim(),
        }));
      const response = await fetch("/api/spoton/mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; saved?: number };
      if (!response.ok) throw new Error(data.error || "Failed to save mapping.");
      setSpotOnMappingMessage(`Saved ${Number(data.saved || mappings.length)} mapping(s).`);
      await loadSpotOnStatus();
    } catch (error) {
      setSpotOnMappingMessage(error instanceof Error ? error.message : "Failed to save mapping.");
    } finally {
      setSpotOnMappingBusy(false);
    }
  }

  function connectPos(provider: PosProvider) {
    setPosMessage("");
    window.location.href = `/api/pos/auth/${provider}?action=connect`;
  }

  async function syncPos(provider: PosProvider) {
    setPosBusy(provider);
    setPosMessage("");
    try {
      const response = await fetch("/api/pos/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Sync failed.");
      setPosMessage(`Synced ${provider} successfully.`);
      await loadPosStatus();
    } catch (error) {
      setPosMessage(error instanceof Error ? error.message : "Sync failed.");
    } finally {
      setPosBusy(null);
    }
  }

  async function disconnectPos(provider: PosProvider) {
    if (!confirm(`Disconnect ${provider}?`)) return;
    setPosBusy(provider);
    setPosMessage("");
    try {
      const response = await fetch("/api/pos/sync", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Disconnect failed.");
      setPosMessage(`${provider} disconnected.`);
      await loadPosStatus();
    } catch (error) {
      setPosMessage(error instanceof Error ? error.message : "Disconnect failed.");
    } finally {
      setPosBusy(null);
    }
  }

  async function testStripeConnection() {
    setStripeTestStatus("testing");
    setStripeTestMessage("");
    try {
      await savePartial({
        stripePublishableKey: (settings.stripePublishableKey || "").trim(),
        stripeSecretKey: (settings.stripeSecretKey || "").trim(),
        stripeWebhookSecret: (settings.stripeWebhookSecret || "").trim(),
      });
      const response = await fetch("/api/payments/test-connection", { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as {
        connected?: boolean;
        accountId?: string;
        businessName?: string | null;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Unable to test Stripe connection.");
      }

      if (data.connected) {
        setStripeTestStatus("connected");
        const label = data.businessName || data.accountId || "Stripe";
        setStripeTestMessage(`Connected to ${label}.`);
      } else {
        setStripeTestStatus("invalid");
        setStripeTestMessage(data.error || "Invalid Stripe key.");
      }
      await loadSettings();
    } catch (error) {
      setStripeTestStatus("invalid");
      setStripeTestMessage(error instanceof Error ? error.message : "Unable to test Stripe connection.");
    }
  }

  async function disconnectStripeConnect() {
    if (!confirm("Disconnect Stripe Connect for this restaurant?")) return;
    setStripeDisconnecting(true);
    setStripeOAuthMessage("");
    try {
      const response = await fetch("/api/stripe/disconnect", { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Failed to disconnect Stripe.");
      setStripeOAuthError(false);
      setStripeOAuthMessage("Stripe account disconnected.");
      setStripeTestStatus("idle");
      setStripeTestMessage("");
      await loadSettings();
    } catch (error) {
      setStripeOAuthError(true);
      setStripeOAuthMessage(error instanceof Error ? error.message : "Failed to disconnect Stripe.");
    } finally {
      setStripeDisconnecting(false);
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

  function setTemplateField(templateId: string, field: TemplateField, value: string) {
    setTemplates((previous) => {
      const current = previous[templateId];
      if (!current) return previous;
      return {
        ...previous,
        [templateId]: {
          ...current,
          [field]: value,
        },
      };
    });
  }

  function insertTemplateVariable(templateId: string, field: TemplateField, variable: string) {
    const selector = `[data-template=\"${templateId}\"][data-field=\"${field}\"]`;
    const el = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement | null;
    const current = templates[templateId]?.[field] || "";
    if (!el) {
      setTemplateField(templateId, field, `${current}${variable}`);
      return;
    }
    const start = typeof el.selectionStart === "number" ? el.selectionStart : current.length;
    const end = typeof el.selectionEnd === "number" ? el.selectionEnd : start;
    const next = `${current.slice(0, start)}${variable}${current.slice(end)}`;
    setTemplateField(templateId, field, next);
    window.setTimeout(() => {
      el.focus();
      const position = start + variable.length;
      try {
        el.setSelectionRange(position, position);
      } catch {
        // ignore
      }
    }, 0);
  }

  async function saveTemplate(templateId: string) {
    const template = templates[templateId];
    if (!template) return;
    setTemplateSaving(templateId);
    setTemplateMessage((previous) => ({ ...previous, [templateId]: "" }));
    try {
      const response = await fetch("/api/email-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          subject: template.subject,
          heading: template.heading,
          body: template.body,
          ctaText: template.ctaText,
          ctaUrl: template.ctaUrl,
          footerText: template.footerText,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save template");
      setTemplates((previous) => ({
        ...previous,
        [templateId]: {
          ...(previous[templateId] || template),
          ...data.template,
          name: previous[templateId]?.name || template.name,
        },
      }));
      setTemplateMessage((previous) => ({ ...previous, [templateId]: "Template saved." }));
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to save template";
      setTemplateMessage((previous) => ({ ...previous, [templateId]: msg }));
    } finally {
      setTemplateSaving(null);
    }
  }

  async function resetTemplate(templateId: string) {
    setTemplateSaving(templateId);
    setTemplateMessage((previous) => ({ ...previous, [templateId]: "" }));
    try {
      const response = await fetch("/api/email-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, reset: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to reset template");
      setTemplates((previous) => ({
        ...previous,
        [templateId]: {
          ...(previous[templateId] || data.template),
          ...data.template,
          name: previous[templateId]?.name || templateId,
        },
      }));
      setTemplateMessage((previous) => ({ ...previous, [templateId]: "Template reset to defaults." }));
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to reset template";
      setTemplateMessage((previous) => ({ ...previous, [templateId]: msg }));
    } finally {
      setTemplateSaving(null);
    }
  }

  async function previewTemplate(templateId: string) {
    const template = templates[templateId];
    if (!template) return;
    setTemplateSaving(templateId);
    setTemplateMessage((previous) => ({ ...previous, [templateId]: "" }));
    try {
      const response = await fetch("/api/email-templates/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          subject: template.subject,
          heading: template.heading,
          body: template.body,
          ctaText: template.ctaText,
          ctaUrl: template.ctaUrl,
          footerText: template.footerText,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Preview failed");
      setPreviewData({ templateId, subject: data.subject, html: data.html });
      setPreviewMode("desktop");
      setPreviewOpen(true);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Preview failed";
      setTemplateMessage((previous) => ({ ...previous, [templateId]: msg }));
    } finally {
      setTemplateSaving(null);
    }
  }

  async function sendTestTemplate(templateId: string) {
    setTemplateTesting(templateId);
    setTemplateMessage((previous) => ({ ...previous, [templateId]: "" }));
    try {
      const recipient = String(testRecipient || currentUserEmail).trim();
      const response = await fetch("/api/email-templates/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, to: recipient || undefined }),
      });
      const data = await response.json();
      if (!response.ok) {
        const detail = data?.error ? ` (${data.error})` : "";
        throw new Error(`Failed to send test email. Check that RESEND_API_KEY is configured.${detail}`);
      }
      const sentTo = data?.sentTo || recipient || currentUserEmail || "your account email";
      setTemplateMessage((previous) => ({
        ...previous,
        [templateId]: `Test email sent to ${sentTo}! Check your inbox.`,
      }));
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to send test email. Check that RESEND_API_KEY is configured.";
      setTemplateMessage((previous) => ({ ...previous, [templateId]: msg }));
    } finally {
      setTemplateTesting(null);
    }
  }

  const maskedLicenseKey = useMemo(() => {
    const raw = settings.license_key || "";
    if (!raw) return "Not configured";
    if (showLicenseKey) return raw;
    if (raw.length <= 8) return "••••••••";
    return `${raw.slice(0, 4)}••••••••${raw.slice(-4)}`;
  }, [settings.license_key, showLicenseKey]);

  const spotOnConfigured = Boolean((settings.spotonApiKey || "").trim() && (settings.spotonLocationId || "").trim());
  const maskedSpotOnApiKey = useMemo(() => {
    const raw = (settings.spotonApiKey || "").trim();
    if (!raw) return "Not configured";
    if (raw.length <= 8) return "••••••••";
    return `${raw.slice(0, 2)}••••••${raw.slice(-2)}`;
  }, [settings.spotonApiKey]);
  const stripeConnectEnabled = settings.stripeConnectEnabled === "true";
  const stripeAccountId = (settings.stripeAccountId || "").trim();
  const stripeConnectedViaOauth = Boolean(stripeAccountId);
  const stripePublishableConfigured = Boolean((settings.stripePublishableKey || "").trim());
  const stripeSecretConfigured = Boolean((settings.stripeSecretKey || "").trim());
  const stripeConfigured = stripePublishableConfigured && stripeSecretConfigured;
  const depositsEnabled = (settings.depositEnabled || settings.depositsEnabled) === "true";

  if (!canManageSettings) return <AccessDenied />;

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
        {(activeTab === "reservations" || activeTab === "notifications") && (
          <button
            onClick={saveChanges}
            disabled={saving}
            className="h-11 w-full rounded-lg bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-70 sm:w-auto"
          >
            {saving ? "Saving..." : saved ? "✓ Saved" : "Save Changes"}
          </button>
        )}
      </div>

      {saveError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</div>
      ) : null}

      <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => {
            const active = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 min-w-[140px] rounded-xl border px-3 py-2 text-left transition-all ${active ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"}`}
              >
                <div className={`text-sm font-semibold ${active ? "text-blue-700" : "text-gray-900"}`}>{tab.label}</div>
                <div className="hidden text-[11px] text-gray-500 sm:block">{tab.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "restaurant" && (
        <LandingBuilder settings={settings} onSavePartial={savePartial} />
      )}

      {activeTab === "reservations" && (
        <div className="space-y-6">
          <Section title="Booking Rules">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <Label>Restaurant Timezone</Label>
                <select
                  value={settings.timezone || "America/New_York"}
                  onChange={(event) => setField("timezone", event.target.value)}
                  className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm"
                >
                  {TIMEZONE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Current time: {currentTimeInTimezone(settings.timezone || "America/New_York", clockMs)}
                </p>
              </div>
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
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h3 className="text-sm font-semibold text-gray-900">Payment Processing</h3>
              <p className="mt-1 text-sm text-gray-600">
                Connect your Stripe account to accept deposits and card holds from guests.
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Don&apos;t have a Stripe account? Create one at{" "}
                <a className="text-blue-700 underline" href="https://stripe.com" target="_blank" rel="noreferrer">
                  stripe.com
                </a>{" "}
                — it takes about 10 minutes.
              </p>

              {stripeOAuthMessage ? (
                <div className={`mt-4 rounded-lg border px-3 py-2 text-sm ${stripeOAuthError ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                  {stripeOAuthMessage}
                </div>
              ) : null}

              {stripeConnectedViaOauth ? (
                <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <div className="text-sm font-semibold text-emerald-800">✓ Connected via Stripe Connect</div>
                  <div className="mt-1 text-xs text-emerald-700">Account: {stripeAccountId}</div>
                  <button
                    type="button"
                    onClick={disconnectStripeConnect}
                    disabled={stripeDisconnecting}
                    className="mt-3 h-10 rounded-lg border border-emerald-300 bg-white px-3 text-sm text-emerald-800 disabled:opacity-60"
                  >
                    {stripeDisconnecting ? "Disconnecting..." : "Disconnect"}
                  </button>
                </div>
              ) : (
                <>
                  {stripeConnectEnabled ? (
                    <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3">
                      <a
                        href="/api/stripe/connect"
                        className="inline-flex h-11 items-center rounded-lg bg-[#635bff] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#7a73ff]"
                      >
                        Connect with Stripe
                      </a>
                      <p className="mt-2 text-xs text-gray-500">One click to connect your Stripe account.</p>
                    </div>
                  ) : null}

                  <div className="mt-4 text-xs uppercase tracking-wide text-gray-500">or enter keys manually</div>

                  <div className="mt-3 grid gap-3">
                    <div>
                      <Label>Stripe Publishable Key</Label>
                      <input
                        type="text"
                        value={settings.stripePublishableKey || ""}
                        onChange={(event) => setField("stripePublishableKey", event.target.value)}
                        placeholder="pk_live_..."
                        className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm"
                      />
                    </div>

                    <div>
                      <Label>Stripe Secret Key</Label>
                      <div className="flex gap-2">
                        <input
                          type={showStripeSecretKey ? "text" : "password"}
                          value={settings.stripeSecretKey || ""}
                          onChange={(event) => setField("stripeSecretKey", event.target.value)}
                          placeholder="sk_live_..."
                          className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowStripeSecretKey((value) => !value)}
                          className="h-11 rounded-lg border border-gray-200 px-3 text-sm"
                        >
                          {showStripeSecretKey ? "Hide" : "Show"}
                        </button>
                      </div>
                    </div>

                    <div>
                      <Label>Stripe Webhook Secret (optional)</Label>
                      <input
                        type="password"
                        value={settings.stripeWebhookSecret || ""}
                        onChange={(event) => setField("stripeWebhookSecret", event.target.value)}
                        placeholder="whsec_..."
                        className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {!stripeConfigured ? (
                      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                        ⚠ Not configured
                      </span>
                    ) : stripeTestStatus === "connected" ? (
                      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        ✓ Connected
                      </span>
                    ) : stripeTestStatus === "invalid" ? (
                      <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                        ✗ Invalid
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                        ⚠ Not verified
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={testStripeConnection}
                      disabled={stripeTestStatus === "testing"}
                      className="h-10 rounded-lg border border-gray-300 px-3 text-sm disabled:opacity-60"
                    >
                      {stripeTestStatus === "testing" ? "Testing..." : "Test Connection"}
                    </button>
                  </div>

                  {stripeTestMessage ? (
                    <p className={`mt-2 text-sm ${stripeTestStatus === "invalid" ? "text-red-600" : "text-emerald-700"}`}>
                      {stripeTestMessage}
                    </p>
                  ) : null}
                </>
              )}
            </div>

            {depositsEnabled && !stripeConfigured ? (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                ⚠ Deposits are enabled but Stripe is not configured. Guests will not be charged.
              </div>
            ) : null}

            <label className="mb-4 flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={depositsEnabled}
                onChange={(event) => {
                  if (event.target.checked && !stripeConfigured) {
                    setStripeTestStatus("invalid");
                    setStripeTestMessage("Configure Stripe keys before enabling deposits.");
                    return;
                  }
                  const value = event.target.checked ? "true" : "false";
                  setField("depositEnabled", value);
                  setField("depositsEnabled", value);
                }}
                className="h-4 w-4"
              />
              Enable deposits / card holds
            </label>

            {depositsEnabled && (
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
          <Section title="Email Delivery">
            <div className="space-y-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              <p>
                Emails are sent from:{" "}
                <span className="font-semibold">
                  {`${settings.restaurantName || "Restaurant"} <reservations@reservesit.com>`}
                </span>
              </p>
              <p>
                Replies go to:{" "}
                <span className="font-semibold">
                  {settings.emailReplyTo || settings.contactEmail || "Not configured"}
                </span>
              </p>
              {!settings.emailReplyTo && !settings.contactEmail && (
                <p className="text-xs text-blue-800">
                  Set a reply-to address below so guest replies go to your inbox.
                </p>
              )}
              <p className="text-xs text-blue-800">
                Guests will see your restaurant name as the sender. When they reply, it goes to your reply-to email.
              </p>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field
                label="Reply-to Email"
                value={settings.emailReplyTo || settings.contactEmail || ""}
                onChange={(v) => setField("emailReplyTo", v)}
                placeholder="hello@restaurant.com"
              />
              <Field
                label="Staff Notification Email"
                value={settings.emailStaffNotification || settings.staffNotificationEmail || ""}
                onChange={(v) => {
                  setField("emailStaffNotification", v);
                  setField("staffNotificationEmail", v);
                }}
                placeholder="manager@restaurant.com"
              />
            </div>
          </Section>

          <Section title="Notification Rules">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={(settings.emailEnabled || "true") === "true"}
                  onChange={(event) => setField("emailEnabled", event.target.checked ? "true" : "false")}
                  className="h-4 w-4"
                />
                Enable email notifications
              </label>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={(settings.emailSendConfirmations || "true") === "true"}
                  onChange={(event) => setField("emailSendConfirmations", event.target.checked ? "true" : "false")}
                  className="h-4 w-4"
                />
                Send reservation confirmations
              </label>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={(settings.emailSendReminders || "true") === "true"}
                  onChange={(event) => {
                    const value = event.target.checked ? "true" : "false";
                    setField("emailSendReminders", value);
                  }}
                  className="h-4 w-4"
                />
                Send reservation reminders
              </label>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={(settings.emailSendWaitlist || "true") === "true"}
                  onChange={(event) => setField("emailSendWaitlist", event.target.checked ? "true" : "false")}
                  className="h-4 w-4"
                />
                Send waitlist notifications
              </label>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={settings.staffNotificationsEnabled === "true"}
                  onChange={(event) => setField("staffNotificationsEnabled", event.target.checked ? "true" : "false")}
                  className="h-4 w-4"
                />
                Enable manager alert emails
              </label>
              <Field
                label="Large Party Threshold"
                type="number"
                value={settings.largePartyThreshold || "6"}
                onChange={(v) => setField("largePartyThreshold", v)}
              />
            </div>
            <div className="mt-4 max-w-xs">
              <Label>Reminder Timing</Label>
              <select
                value={settings.emailReminderTiming || settings.reminderLeadHours || "24"}
                onChange={(event) => {
                  setField("emailReminderTiming", event.target.value);
                  setField("reminderLeadHours", event.target.value);
                }}
                className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm"
              >
                <option value="2">2 hours before</option>
                <option value="4">4 hours before</option>
                <option value="24">24 hours before</option>
              </select>
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

          <Section title="Email Templates">
            <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              Use variables like <code>{"{{guestName}}"}</code>, <code>{"{{date}}"}</code>, and <code>{"{{manageUrl}}"}</code> in your template content.
            </div>

            {templateMessage.__global && <p className="mb-4 text-sm text-red-600">{templateMessage.__global}</p>}

            {templateLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                Loading templates...
              </div>
            ) : (
              <div className="space-y-3">
                {Object.values(templates).map((template) => {
                  const expanded = templateExpanded === template.id;
                  return (
                    <article key={template.id} className="rounded-xl border border-gray-200 bg-white">
                      <button
                        type="button"
                        onClick={() => setTemplateExpanded(expanded ? null : template.id)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                      >
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{template.name}</div>
                          <div className="text-xs text-gray-500">{template.subject}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {template.customized && (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                              Customized
                            </span>
                          )}
                          <span className="text-xs text-gray-500">{expanded ? "Hide" : "Edit"}</span>
                        </div>
                      </button>

                      {expanded && (
                        <div className="border-t border-gray-100 px-4 py-4">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                              <Label>Subject</Label>
                              <input
                                data-template={template.id}
                                data-field="subject"
                                value={template.subject}
                                onChange={(event) => setTemplateField(template.id, "subject", event.target.value)}
                                className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <Label>Heading</Label>
                              <input
                                data-template={template.id}
                                data-field="heading"
                                value={template.heading}
                                onChange={(event) => setTemplateField(template.id, "heading", event.target.value)}
                                className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <Label>Body</Label>
                              <textarea
                                data-template={template.id}
                                data-field="body"
                                value={template.body}
                                onChange={(event) => setTemplateField(template.id, "body", event.target.value)}
                                rows={7}
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                              />
                              <div className="mt-2 flex flex-wrap gap-2">
                                {TEMPLATE_VARIABLES.map((variable) => (
                                  <button
                                    key={`${template.id}-body-${variable}`}
                                    type="button"
                                    onClick={() => insertTemplateVariable(template.id, "body", variable)}
                                    className="rounded-full border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700"
                                  >
                                    {variable}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <Label>CTA Text</Label>
                              <input
                                data-template={template.id}
                                data-field="ctaText"
                                value={template.ctaText}
                                onChange={(event) => setTemplateField(template.id, "ctaText", event.target.value)}
                                className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                              />
                            </div>
                            <div>
                              <Label>CTA URL</Label>
                              <input
                                data-template={template.id}
                                data-field="ctaUrl"
                                value={template.ctaUrl}
                                onChange={(event) => setTemplateField(template.id, "ctaUrl", event.target.value)}
                                className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <Label>Footer Text</Label>
                              <input
                                data-template={template.id}
                                data-field="footerText"
                                value={template.footerText}
                                onChange={(event) => setTemplateField(template.id, "footerText", event.target.value)}
                                className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                              />
                            </div>
                          </div>

                          <div className="mt-4 grid gap-2 md:flex md:flex-wrap md:items-center">
                            <button
                              type="button"
                              onClick={() => previewTemplate(template.id)}
                              disabled={templateSaving === template.id}
                              className="h-11 rounded-lg border border-gray-300 px-3 text-sm"
                            >
                              Preview
                            </button>
                            <input
                              type="email"
                              value={testRecipient}
                              onChange={(event) => setTestRecipient(event.target.value)}
                              placeholder="Enter email address"
                              className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm md:w-64"
                            />
                            <button
                              type="button"
                              onClick={() => sendTestTemplate(template.id)}
                              disabled={templateTesting === template.id}
                              className="h-11 rounded-lg border border-gray-300 px-3 text-sm"
                            >
                              {templateTesting === template.id ? "Sending..." : "Send Test Email"}
                            </button>
                            <span className="self-center text-xs text-gray-500 md:ml-1">
                              Test will be sent to: {testRecipient || currentUserEmail || "your account email"}
                            </span>
                            <button
                              type="button"
                              onClick={() => resetTemplate(template.id)}
                              disabled={templateSaving === template.id}
                              className="h-11 rounded-lg border border-red-200 px-3 text-sm text-red-700"
                            >
                              Reset to Default
                            </button>
                            <button
                              type="button"
                              onClick={() => saveTemplate(template.id)}
                              disabled={templateSaving === template.id}
                              className="h-11 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-70"
                            >
                              {templateSaving === template.id ? "Saving..." : "Save"}
                            </button>
                          </div>

                          {templateMessage[template.id] && (
                            <p className={`mt-3 text-sm ${templateMessage[template.id].toLowerCase().includes("failed") || templateMessage[template.id].toLowerCase().includes("could not") ? "text-red-600" : "text-green-700"}`}>
                              {templateMessage[template.id]}
                            </p>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </Section>
        </div>
      )}

      {activeTab === "integrations" && (
        <div className="space-y-6">
          <Section title="Integrations">
            <p className="text-sm text-gray-600">
              Connect your POS system to sync menu items, tables, and business hours. Sync is read-only.
            </p>

            {posMessage ? (
              <div className={`mt-3 rounded-lg border px-3 py-2 text-sm ${posMessage.toLowerCase().includes("failed") || posMessage.toLowerCase().includes("error") ? "border-red-200 bg-red-50 text-red-700" : "border-blue-200 bg-blue-50 text-blue-700"}`}>
                {posMessage}
              </div>
            ) : null}

            {posLoading || spotOnLoading ? (
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                Loading integration status...
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <article className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📍</span>
                        <h3 className="text-base font-semibold text-gray-900">SpotOn POS</h3>
                        {spotOnConfigured ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                            Connected
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-gray-600">
                        Real-time table status, auto-complete reservations when checks close.
                      </p>
                      {spotOnConfigured ? (
                        <p className="mt-1 text-xs text-gray-500">
                          Last sync: {spotOnStatus.spotonLastSync ? formatDateTime(spotOnStatus.spotonLastSync) : "Never"} · {spotOnStatus.openChecks} open checks
                        </p>
                      ) : null}
                      {!spotOnStatus.licensed ? (
                        <p className="mt-1 text-xs text-amber-700">POS integration requires an active POS module license.</p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSpotOnExpanded((value) => !value)}
                        className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white"
                      >
                        {spotOnExpanded ? "Hide" : spotOnConfigured ? "Manage" : "Configure"}
                      </button>
                    </div>
                  </div>

                  {spotOnExpanded ? (
                    <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label>SpotOn API Key</Label>
                          <input
                            type="password"
                            value={settings.spotonApiKey || ""}
                            onChange={(event) => setField("spotonApiKey", event.target.value)}
                            placeholder="Enter SpotOn API key"
                            className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                          />
                        </div>
                        <div>
                          <Label>Location ID</Label>
                          <input
                            value={settings.spotonLocationId || ""}
                            onChange={(event) => setField("spotonLocationId", event.target.value)}
                            placeholder="Location ID"
                            className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                          />
                        </div>
                      </div>

                      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={settings.spotonUseMock === "true"}
                          onChange={(event) => setField("spotonUseMock", event.target.checked ? "true" : "false")}
                          className="h-4 w-4"
                        />
                        Use Mock Data
                      </label>

                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                        <div>API Key: {maskedSpotOnApiKey}</div>
                        <div>Location ID: {(settings.spotonLocationId || "").trim() || "Not configured"}</div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={saveSpotOnConfig}
                          disabled={spotOnSaving}
                          className="h-10 rounded-lg border border-gray-300 px-3 text-sm"
                        >
                          {spotOnSaving ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={syncSpotOnNow}
                          disabled={!spotOnConfigured || !spotOnStatus.licensed || spotOnSyncing}
                          className="h-10 rounded-lg border border-gray-300 px-3 text-sm disabled:opacity-60"
                        >
                          {spotOnSyncing ? "Syncing..." : "Sync Now"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSpotOnMappingOpen((value) => !value)}
                          disabled={!spotOnConfigured || !spotOnStatus.licensed}
                          className="h-10 rounded-lg border border-gray-300 px-3 text-sm disabled:opacity-60"
                        >
                          {spotOnMappingOpen ? "Hide Table Mapping" : "Table Mapping"}
                        </button>
                        <button
                          type="button"
                          onClick={disconnectSpotOn}
                          disabled={!spotOnConfigured || spotOnSaving}
                          className="h-10 rounded-lg border border-red-200 px-3 text-sm text-red-700 disabled:opacity-60"
                        >
                          Disconnect
                        </button>
                      </div>

                      {spotOnMessage ? (
                        <p className={`text-sm ${spotOnMessage.toLowerCase().includes("failed") || spotOnMessage.toLowerCase().includes("error") ? "text-red-600" : "text-green-700"}`}>
                          {spotOnMessage}
                        </p>
                      ) : null}

                      {spotOnMappingOpen ? (
                        <div className="space-y-3 rounded-lg border border-gray-200 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="text-sm font-semibold text-gray-900">Table Mapping</h4>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={autoMatchSpotOnTables}
                                disabled={spotOnMappingBusy}
                                className="h-9 rounded-lg border border-gray-300 px-3 text-xs"
                              >
                                Auto-Match
                              </button>
                              <button
                                type="button"
                                onClick={saveSpotOnMapping}
                                disabled={spotOnMappingBusy}
                                className="h-9 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white"
                              >
                                Save Mapping
                              </button>
                            </div>
                          </div>

                          <div className="space-y-2">
                            {spotOnMappingRows.map((row) => (
                              <div key={row.rowId} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                                <select
                                  value={row.reservekitTableId}
                                  onChange={(event) => {
                                    const next = event.target.value ? Number(event.target.value) : "";
                                    setSpotOnMappingRow(row.rowId, { reservekitTableId: next });
                                  }}
                                  className="h-10 rounded-lg border border-gray-200 px-3 text-sm"
                                >
                                  <option value="">ReserveSit Table</option>
                                  {spotOnTables.map((table) => (
                                    <option key={table.id} value={table.id}>
                                      {table.name}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  value={row.spotOnTable}
                                  onChange={(event) => setSpotOnMappingRow(row.rowId, { spotOnTable: event.target.value })}
                                  placeholder="SpotOn table name/number"
                                  className="h-10 rounded-lg border border-gray-200 px-3 text-sm"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeSpotOnMappingRow(row.rowId)}
                                  className="h-10 rounded-lg border border-red-200 px-3 text-sm text-red-700"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={addSpotOnMappingRow}
                            className="h-9 rounded-lg border border-gray-300 px-3 text-xs"
                          >
                            + Add Mapping Row
                          </button>

                          {spotOnMappingMessage ? (
                            <p className={`text-xs ${spotOnMappingMessage.toLowerCase().includes("failed") || spotOnMappingMessage.toLowerCase().includes("error") ? "text-red-600" : "text-gray-700"}`}>
                              {spotOnMappingMessage}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </article>

                {POS_PROVIDERS.map((provider) => {
                  const connected =
                    posStatus?.connected &&
                    posStatus.provider === provider.key &&
                    Boolean(posStatus.credentialsPresent?.[provider.key]);
                  const available = Boolean(posStatus?.availability?.[provider.key]);
                  const comingSoon = provider.key === "toast" && !available;

                  return (
                    <article key={provider.key} className="rounded-xl border border-gray-200 bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{provider.icon}</span>
                            <h3 className="text-base font-semibold text-gray-900">{provider.name}</h3>
                            {connected ? (
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                                Connected
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-gray-600">{provider.description}</p>
                          {connected ? (
                            <p className="mt-1 text-xs text-gray-500">
                              Location: {posStatus?.locationName || "Unknown"} · Last sync: {posStatus?.lastSync ? formatDateTime(posStatus.lastSync) : "Never"} · {posStatus?.counts.menuItems || 0} menu items
                            </p>
                          ) : null}
                          {comingSoon ? (
                            <p className="mt-1 text-xs text-amber-700">Pending Toast partner approval.</p>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {connected ? (
                            <>
                              <button
                                type="button"
                                onClick={() => syncPos(provider.key)}
                                disabled={posBusy === provider.key}
                                className="h-10 rounded-lg border border-gray-300 px-3 text-sm"
                              >
                                {posBusy === provider.key ? "Syncing..." : "Sync Now"}
                              </button>
                              <button
                                type="button"
                                onClick={() => disconnectPos(provider.key)}
                                disabled={posBusy === provider.key}
                                className="h-10 rounded-lg border border-red-200 px-3 text-sm text-red-700"
                              >
                                Disconnect
                              </button>
                            </>
                          ) : comingSoon ? (
                            <button
                              type="button"
                              disabled
                              className="h-10 rounded-lg border border-amber-200 bg-amber-50 px-3 text-sm text-amber-700"
                            >
                              Coming Soon
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => connectPos(provider.key)}
                              disabled={posBusy === provider.key}
                              className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white"
                            >
                              Connect
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
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

      {previewOpen && previewData && (
        <div className="fixed inset-0 z-50 bg-black/60 p-0 sm:flex sm:items-center sm:justify-center sm:px-3 sm:py-6">
          <div className="h-full w-full overflow-hidden bg-white shadow-xl sm:max-h-[92vh] sm:max-w-6xl sm:rounded-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">Email Preview</div>
                <div className="text-xs text-gray-500">{previewData.subject}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewMode("mobile")}
                  className={`h-8 rounded-md px-2 text-xs ${previewMode === "mobile" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}
                >
                  Mobile
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("desktop")}
                  className={`h-8 rounded-md px-2 text-xs ${previewMode === "desktop" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}
                >
                  Desktop
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewOpen(false);
                    setPreviewData(null);
                  }}
                  className="h-8 rounded-md border border-gray-300 px-2 text-xs"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="max-h-[80vh] overflow-auto bg-gray-100 p-4">
              <div className={`mx-auto overflow-hidden rounded-lg border border-gray-200 bg-white ${previewMode === "mobile" ? "max-w-[390px]" : "max-w-[920px]"}`}>
                <iframe
                  title="Email preview"
                  srcDoc={previewData.html}
                  className="h-[68vh] w-full"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
