"use client";

import { useEffect, useMemo, useState } from "react";
import LandingBuilder from "@/components/landing-builder";

type SettingsTab = "restaurant" | "reservations" | "notifications" | "license";

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
  { key: "license", label: "License", description: "Read-only plan and feature status" },
];

const FEATURE_ROWS = [
  { key: "feature_sms", label: "SMS Notifications" },
  { key: "feature_floorplan", label: "Visual Floor Plan" },
  { key: "feature_reporting", label: "Reporting Dashboard" },
  { key: "feature_guest_history", label: "Guest History" },
  { key: "feature_event_ticketing", label: "Event Ticketing" },
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
  const [templates, setTemplates] = useState<Record<string, EmailTemplate>>({});
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateExpanded, setTemplateExpanded] = useState<string | null>(null);
  const [templateSaving, setTemplateSaving] = useState<string | null>(null);
  const [templateTesting, setTemplateTesting] = useState<string | null>(null);
  const [templateMessage, setTemplateMessage] = useState<Record<string, string>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [previewData, setPreviewData] = useState<{ templateId: string; subject: string; html: string } | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState("");

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
      setCurrentUserEmail(String(data.email || ""));
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
    if (activeTab !== "notifications") return;
    if (templateLoading || Object.keys(templates).length > 0) return;
    loadTemplates().catch(() => undefined);
  }, [activeTab, templateLoading, templates]);

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

  async function savePartial(patch: Record<string, string>) {
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSettings((previous) => ({ ...previous, ...patch }));
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
      const response = await fetch("/api/email-templates/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      const data = await response.json();
      if (!response.ok) {
        const detail = data?.error ? ` (${data.error})` : "";
        throw new Error(`Failed to send test email. Check that RESEND_API_KEY is configured.${detail}`);
      }
      const sentTo = data?.sentTo || currentUserEmail || "your account email";
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
        {activeTab !== "license" && activeTab !== "restaurant" && (
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
        <LandingBuilder settings={settings} onSavePartial={savePartial} />
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

                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => previewTemplate(template.id)}
                              disabled={templateSaving === template.id}
                              className="h-10 rounded-lg border border-gray-300 px-3 text-sm"
                            >
                              Preview
                            </button>
                            <button
                              type="button"
                              onClick={() => sendTestTemplate(template.id)}
                              disabled={templateTesting === template.id}
                              className="h-10 rounded-lg border border-gray-300 px-3 text-sm"
                            >
                              {templateTesting === template.id ? "Sending..." : "Send Test Email"}
                            </button>
                            <span className="self-center text-xs text-gray-500">
                              Test will be sent to: {currentUserEmail || "your account email"}
                            </span>
                            <button
                              type="button"
                              onClick={() => resetTemplate(template.id)}
                              disabled={templateSaving === template.id}
                              className="h-10 rounded-lg border border-red-200 px-3 text-sm text-red-700"
                            >
                              Reset to Default
                            </button>
                            <button
                              type="button"
                              onClick={() => saveTemplate(template.id)}
                              disabled={templateSaving === template.id}
                              className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-70"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-3 py-6">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-xl bg-white shadow-xl">
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
