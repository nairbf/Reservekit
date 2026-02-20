"use client";

import { useEffect, useMemo, useState } from "react";
import AccessDenied from "@/components/access-denied";
import { useHasPermission } from "@/hooks/use-permissions";
import { RestaurantTab } from "./restaurant-tab";
import { ReservationsTab } from "./reservations-tab";
import { NotificationsTab } from "./notifications-tab";
import { IntegrationsTab } from "./integrations-tab";
import { LinksTab } from "./links-tab";
import { SmartFeaturesTab } from "./smart-features-tab";
import { LicenseTab } from "./license-tab";

type SettingsTab = "restaurant" | "reservations" | "notifications" | "integrations" | "links" | "smart" | "license";

export type SettingsMap = Record<string, string>;
type TemplateField = "subject" | "heading" | "body" | "ctaText" | "ctaUrl" | "footerText";

export interface SettingsTabProps {
  settings: Record<string, string>;
  setField: (key: string, value: string) => void;
  savePartial: (fields: Record<string, string>) => Promise<void>;
  saving: boolean;
}

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
  { key: "links", label: "Links", description: "Share URLs, embed code, and QR downloads" },
  { key: "smart", label: "Smart Features", description: "Quiet intelligence for service, guests, and pacing" },
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
  "depositType",
  "depositAmount",
  "depositMinPartySize",
  "depositMessage",
  "specialDepositRules",
  "noshowChargeEnabled",
  "noshowChargeAmount",
  "emailEnabled",
  "emailSendConfirmations",
  "emailSendReminders",
  "emailSendWaitlist",
  "reminderLeadHours",
  "replyToEmail",
  "staffNotificationEmail",
  "staffNotificationsEnabled",
  "largePartyThreshold",
  "twilioSid",
  "twilioToken",
  "twilioPhone",
  "sms_template_confirmed",
  "sms_template_reminder",
  "sms_template_cancelled",
  "sms_template_waitlist_ready",
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
  "smartTurnTime",
  "smartNoShowRisk",
  "smartGuestIntel",
  "smartWaitlistEstimate",
  "smartDailyPrep",
  "smartPacingAlerts",
  "reserveHeading",
  "reserveSubheading",
  "reserveConfirmationMessage",
  "setupWizardStep",
  "setupWizardCompleted",
  "setupWizardCompletedAt",
]);

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
  const [spotOnMenuSyncing, setSpotOnMenuSyncing] = useState(false);
  const [spotOnMenuMessage, setSpotOnMenuMessage] = useState("");
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
    if (requestedTab === "restaurant" || requestedTab === "reservations" || requestedTab === "notifications" || requestedTab === "integrations" || requestedTab === "links" || requestedTab === "smart" || requestedTab === "license") {
      setActiveTab(requestedTab);
    }
    if (params.get("connected") === "true") {
      setPosMessage("POS provider connected.");
    }
    const error = params.get("error");
    if (error) setPosMessage(error);

    if (params.get("stripe_connected") === "true") {
      setActiveTab("integrations");
      setStripeOAuthError(false);
      setStripeOAuthMessage("Stripe account connected successfully.");
      setStripeTestStatus("connected");
    }
    const stripeError = params.get("stripe_error");
    if (stripeError) {
      setActiveTab("integrations");
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

  async function syncSpotOnMenu() {
    setSpotOnMenuSyncing(true);
    setSpotOnMenuMessage("");
    try {
      const response = await fetch("/api/spoton/menu-sync", { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        created?: number;
        updated?: number;
        skipped?: number;
        useMock?: boolean;
      };
      if (!response.ok || !data.success) throw new Error(data.error || "SpotOn menu sync failed.");
      const created = Number(data.created || 0);
      const updated = Number(data.updated || 0);
      const skipped = Number(data.skipped || 0);
      const suffix = data.useMock ? " (mock mode)" : "";
      setSpotOnMenuMessage(`Menu sync complete. ${created} created, ${updated} updated, ${skipped} skipped.${suffix}`);
      await loadSettings();
    } catch (error) {
      setSpotOnMenuMessage(error instanceof Error ? error.message : "SpotOn menu sync failed.");
    } finally {
      setSpotOnMenuSyncing(false);
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
      setSpotOnMenuMessage("");
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
  const replyToEmail = settings.replyToEmail || settings.emailReplyTo || settings.contactEmail || "";
  const staffNotificationEmail = settings.staffNotificationEmail || settings.emailStaffNotification || "";
  const reminderLeadHours = settings.reminderLeadHours || settings.emailReminderTiming || "24";

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
        {(activeTab === "reservations" || activeTab === "notifications" || activeTab === "integrations") && (
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
        <RestaurantTab
          settings={settings}
          setField={setField}
          savePartial={savePartial}
          saving={saving}
        />
      )}

      {activeTab === "reservations" && (
        <ReservationsTab
          settings={settings}
          setField={setField}
          savePartial={savePartial}
          saving={saving}
          TIMEZONE_OPTIONS={TIMEZONE_OPTIONS}
          currentTimeInTimezone={currentTimeInTimezone}
          clockMs={clockMs}
          stripeConfigured={stripeConfigured}
          depositsEnabled={depositsEnabled}
          setStripeTestStatus={setStripeTestStatus}
          setStripeTestMessage={setStripeTestMessage}
          onGoToIntegrations={() => setActiveTab("integrations")}
        />
      )}

      {activeTab === "notifications" && (
        <NotificationsTab
          settings={settings}
          setField={setField}
          savePartial={savePartial}
          saving={saving}
          replyToEmail={replyToEmail}
          staffNotificationEmail={staffNotificationEmail}
          reminderLeadHours={reminderLeadHours}
          smsEnabled={smsEnabled}
          templates={templates}
          templateLoading={templateLoading}
          templateExpanded={templateExpanded}
          setTemplateExpanded={setTemplateExpanded}
          TEMPLATE_VARIABLES={TEMPLATE_VARIABLES}
          insertTemplateVariable={insertTemplateVariable}
          testRecipient={testRecipient}
          setTestRecipient={setTestRecipient}
          currentUserEmail={currentUserEmail}
          templateSaving={templateSaving}
          templateTesting={templateTesting}
          templateMessage={templateMessage}
          setTemplateField={setTemplateField}
          saveTemplate={saveTemplate}
          resetTemplate={resetTemplate}
          previewTemplate={previewTemplate}
          sendTestTemplate={sendTestTemplate}
        />
      )}

      {activeTab === "integrations" && (
        <IntegrationsTab
          settings={settings}
          setField={setField}
          savePartial={savePartial}
          saving={saving}
          stripeOAuthMessage={stripeOAuthMessage}
          stripeOAuthError={stripeOAuthError}
          stripeConnectedViaOauth={stripeConnectedViaOauth}
          stripeAccountId={stripeAccountId}
          disconnectStripeConnect={disconnectStripeConnect}
          stripeDisconnecting={stripeDisconnecting}
          stripeConnectEnabled={stripeConnectEnabled}
          showStripeSecretKey={showStripeSecretKey}
          setShowStripeSecretKey={setShowStripeSecretKey}
          stripeConfigured={stripeConfigured}
          stripeTestStatus={stripeTestStatus}
          testStripeConnection={testStripeConnection}
          stripeTestMessage={stripeTestMessage}
          posMessage={posMessage}
          posLoading={posLoading}
          spotOnLoading={spotOnLoading}
          spotOnConfigured={spotOnConfigured}
          spotOnStatus={spotOnStatus}
          spotOnExpanded={spotOnExpanded}
          setSpotOnExpanded={setSpotOnExpanded}
          maskedSpotOnApiKey={maskedSpotOnApiKey}
          saveSpotOnConfig={saveSpotOnConfig}
          spotOnSaving={spotOnSaving}
          syncSpotOnNow={syncSpotOnNow}
          spotOnSyncing={spotOnSyncing}
          syncSpotOnMenu={syncSpotOnMenu}
          spotOnMenuSyncing={spotOnMenuSyncing}
          spotOnMenuMessage={spotOnMenuMessage}
          spotOnMappingOpen={spotOnMappingOpen}
          setSpotOnMappingOpen={setSpotOnMappingOpen}
          disconnectSpotOn={disconnectSpotOn}
          spotOnMessage={spotOnMessage}
          spotOnMappingBusy={spotOnMappingBusy}
          autoMatchSpotOnTables={autoMatchSpotOnTables}
          saveSpotOnMapping={saveSpotOnMapping}
          spotOnMappingRows={spotOnMappingRows}
          setSpotOnMappingRow={setSpotOnMappingRow}
          spotOnTables={spotOnTables}
          removeSpotOnMappingRow={removeSpotOnMappingRow}
          addSpotOnMappingRow={addSpotOnMappingRow}
          spotOnMappingMessage={spotOnMappingMessage}
          POS_PROVIDERS={POS_PROVIDERS}
          posStatus={posStatus}
          posBusy={posBusy}
          formatDateTime={formatDateTime}
          syncPos={syncPos}
          disconnectPos={disconnectPos}
          connectPos={connectPos}
        />
      )}

      {activeTab === "links" && <LinksTab settings={settings} />}

      {activeTab === "smart" && (
        <SmartFeaturesTab
          settings={settings}
          setField={setField}
          savePartial={savePartial}
          saving={saving}
        />
      )}

      {activeTab === "license" && (
        <LicenseTab
          settings={settings}
          setField={setField}
          savePartial={savePartial}
          saving={saving}
          maskedLicenseKey={maskedLicenseKey}
          showLicenseKey={showLicenseKey}
          setShowLicenseKey={setShowLicenseKey}
          copyLicenseKey={copyLicenseKey}
          planBadge={planBadge}
          statusBadge={statusBadge}
          formatDateTime={formatDateTime}
          validateNow={validateNow}
          licenseBusy={licenseBusy}
          licenseMessage={licenseMessage}
          FEATURE_ROWS={FEATURE_ROWS}
        />
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
