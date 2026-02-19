"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type {
  HealthStatus,
  HostingStatus,
  LicenseEventType,
  RestaurantPlan,
  RestaurantStatus,
} from "@/generated/prisma/client";
import { useSessionUser } from "@/components/session-provider";
import { useToast } from "@/components/toast-provider";
import { formatDateTime } from "@/lib/format";
import { HealthStatusBadge, PlanBadge, RestaurantStatusBadge } from "@/components/status-badge";
import { OverviewTab } from "./overview-tab";
import { SettingsTab } from "./settings-tab";
import { UsersTab } from "./users-tab";
import { LicenseTab } from "./license-tab";
import { ProvisionTab } from "./provision-tab";

const ADDONS = [
  { key: "addonSms", label: "SMS Notifications", price: "$199" },
  { key: "addonFloorPlan", label: "Visual Floor Plan", price: "$249" },
  { key: "addonReporting", label: "Reporting Dashboard", price: "$179" },
  { key: "addonGuestHistory", label: "Guest History", price: "$179" },
  { key: "addonEventTicketing", label: "Event Ticketing", price: "$129" },
] as const;

const TIMEZONE_OPTIONS = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Phoenix",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
] as const;

type AddonKey = (typeof ADDONS)[number]["key"];

type SyncState = "" | "synced" | "failed";
type TabKey = "Overview" | "Settings" | "Users" | "Emails" | "Activity";

const TABS: TabKey[] = ["Overview", "Settings", "Users", "Emails", "Activity"];
const EMAIL_TEMPLATES = [
  { id: "welcome", label: "Welcome Email", description: "License key, login URL, getting started" },
  { id: "setup_checkin", label: "Setup Check-in (24hr)", description: "How's your setup going?" },
  { id: "tips", label: "5 Tips Email (7-day)", description: "Tips to get the most out of ReserveSit" },
  { id: "custom", label: "Custom Email", description: "Write your own message" },
] as const;

type EmailTemplateId = (typeof EMAIL_TEMPLATES)[number]["id"];

type RestaurantUser = {
  id: number;
  email: string;
  name: string;
  role: string;
  isActive: number | boolean;
  createdAt: string;
};

type EmailSequenceRow = {
  id: string;
  trigger: string;
  sequenceStep: number;
  scheduledAt: string;
  sentAt: string | null;
  emailTo: string;
  emailSubject: string;
  status: "pending" | "sent" | "failed" | "cancelled" | string;
  createdAt: string;
};

type RestaurantSettings = {
  restaurantName: string;
  contactEmail: string;
  replyToEmail: string;
  staffNotificationEmail: string;
  staffNotificationsEnabled: boolean;
  timezone: string;
  accentColor: string;
  slug: string;
  phone: string;
  address: string;
  emailEnabled: boolean;
  emailSendConfirmations: boolean;
  emailSendReminders: boolean;
  emailReminderTiming: string;
  largePartyThreshold: string;
  tagline: string;
  description: string;
  heroImageUrl: string;
  logoUrl: string;
  faviconUrl: string;
};

function boolSetting(value: string | undefined) {
  return String(value || "").toLowerCase() === "true";
}

type RestaurantDetail = {
  id: string;
  slug: string;
  name: string;
  domain: string | null;
  adminEmail: string;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  status: RestaurantStatus;
  provisionStatus: string;
  provisionLog: string | null;
  generatedPassword: string | null;
  plan: RestaurantPlan;
  hosted: boolean;
  hostingStatus: HostingStatus;
  port: number;
  dbPath: string;
  licenseKey: string;
  licenseExpiry: string | null;
  licenseActivatedAt: string | null;
  trialEndsAt: string | null;
  monthlyHostingActive: boolean;
  notes: string | null;
  addonSms: boolean;
  addonFloorPlan: boolean;
  addonReporting: boolean;
  addonGuestHistory: boolean;
  addonEventTicketing: boolean;
  createdAt: string;
  updatedAt: string;
  healthChecks: Array<{
    id: string;
    status: HealthStatus;
    responseTimeMs: number | null;
    checkedAt: string;
  }>;
  licenseEvents: Array<{
    id: string;
    event: LicenseEventType;
    details: string | null;
    performedBy: string | null;
    createdAt: string;
  }>;
  emailSequences: EmailSequenceRow[];
};

function isIncludedInPlan(plan: RestaurantPlan, addon: AddonKey) {
  if (plan === "FULL_SUITE") return true;
  if (plan === "SERVICE_PRO") {
    return addon === "addonSms" || addon === "addonFloorPlan" || addon === "addonReporting";
  }
  return false;
}

function sequenceStatusClass(status: string) {
  if (status === "sent") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "pending") return "bg-amber-50 text-amber-700 border-amber-200";
  if (status === "failed") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function provisionStatusClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (normalized === "provisioning") return "border-amber-200 bg-amber-50 text-amber-700";
  if (normalized === "failed") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function buildTemplatePreview(templateId: Exclude<EmailTemplateId, "custom">, restaurant: RestaurantDetail) {
  const ownerName = restaurant.ownerName || restaurant.ownerEmail?.split("@")[0] || "Owner";
  const dashboardUrl = `https://${restaurant.domain || `${restaurant.slug}.reservesit.com`}/login`;

  if (templateId === "welcome") {
    return {
      subject: `Welcome to ReserveSit, ${ownerName}!`,
      body: `Hi ${ownerName},\n\nThank you for purchasing ReserveSit ${restaurant.plan} for ${restaurant.name}!`,
    };
  }

  if (templateId === "setup_checkin") {
    return {
      subject: `How's your ReserveSit setup going, ${ownerName}?`,
      body: `Hi ${ownerName},\n\nJust checking in — have you had a chance to set up ${restaurant.name} on ReserveSit?\n\nDashboard: ${dashboardUrl}`,
    };
  }

  return {
    subject: "5 tips to get the most out of ReserveSit",
    body: `Hi ${ownerName},\n\nYou've had ${restaurant.name} on ReserveSit for a week now. Here are 5 tips to make the most of it.`,
  };
}

export default function RestaurantDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const user = useSessionUser();
  const { showToast } = useToast();

  const [restaurant, setRestaurant] = useState<RestaurantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("Overview");
  const [showKey, setShowKey] = useState(false);
  const [showProvisionLog, setShowProvisionLog] = useState(false);
  const [syncStatus, setSyncStatus] = useState<Record<AddonKey, SyncState>>({
    addonSms: "",
    addonFloorPlan: "",
    addonReporting: "",
    addonGuestHistory: "",
    addonEventTicketing: "",
  });

  const [overview, setOverview] = useState({
    name: "",
    domain: "",
    adminEmail: "",
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
    hosted: true,
    hostingStatus: "ACTIVE",
    monthlyHostingActive: true,
    port: "",
    dbPath: "",
  });

  const [notes, setNotes] = useState("");
  const [planSelection, setPlanSelection] = useState<RestaurantPlan>("CORE");
  const [staffUsers, setStaffUsers] = useState<RestaurantUser[]>([]);
  const [restaurantSettings, setRestaurantSettings] = useState<RestaurantSettings>({
    restaurantName: "",
    contactEmail: "",
    replyToEmail: "",
    staffNotificationEmail: "",
    staffNotificationsEnabled: true,
    timezone: "America/New_York",
    accentColor: "#1e3a5f",
    slug: "",
    phone: "",
    address: "",
    emailEnabled: true,
    emailSendConfirmations: true,
    emailSendReminders: true,
    emailReminderTiming: "24",
    largePartyThreshold: "8",
    tagline: "",
    description: "",
    heroImageUrl: "",
    logoUrl: "",
    faviconUrl: "",
  });
  const [showNewUser, setShowNewUser] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "manager",
  });
  const [editUserRole, setEditUserRole] = useState<Record<number, string>>({});
  const [editUserName, setEditUserName] = useState<Record<number, string>>({});
  const [editUserEmail, setEditUserEmail] = useState<Record<number, string>>({});
  const [resetPasswordValue, setResetPasswordValue] = useState<Record<number, string>>({});
  const [selectedEmailTemplate, setSelectedEmailTemplate] = useState<EmailTemplateId>("welcome");
  const [manualEmailTo, setManualEmailTo] = useState("");
  const [manualEmailSubject, setManualEmailSubject] = useState("");
  const [manualEmailBody, setManualEmailBody] = useState("");

  const canManage = useMemo(() => user.role === "ADMIN" || user.role === "SUPER_ADMIN", [user.role]);
  const canLoginAs = user.role === "SUPER_ADMIN";
  const healthLatest = restaurant?.healthChecks?.[0] || null;
  const emailSummary = useMemo(() => {
    const rows = restaurant?.emailSequences || [];
    return {
      queued: rows.filter((row) => row.status === "pending").length,
      sent: rows.filter((row) => row.status === "sent").length,
      failed: rows.filter((row) => row.status === "failed").length,
    };
  }, [restaurant?.emailSequences]);

  useEffect(() => {
    if (!restaurant) return;
    if (!manualEmailTo) {
      setManualEmailTo(restaurant.ownerEmail || restaurant.adminEmail || "");
    }
  }, [restaurant, manualEmailTo]);

  useEffect(() => {
    if (!restaurant) return;
    if (selectedEmailTemplate === "custom") return;

    const preview = buildTemplatePreview(selectedEmailTemplate, restaurant);
    setManualEmailSubject(preview.subject);
    setManualEmailBody(preview.body);
  }, [restaurant, selectedEmailTemplate]);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/restaurants/${id}`, { cache: "no-store" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to load restaurant");
      }
      const payload = (await res.json()) as RestaurantDetail;
      setRestaurant(payload);
      setPlanSelection(payload.plan);
      setOverview({
        name: payload.name,
        domain: payload.domain || `${payload.slug}.reservesit.com`,
        adminEmail: payload.adminEmail,
        ownerName: payload.ownerName || "",
        ownerEmail: payload.ownerEmail || "",
        ownerPhone: payload.ownerPhone || "",
        hosted: payload.hosted,
        hostingStatus: payload.hostingStatus,
        monthlyHostingActive: payload.monthlyHostingActive,
        port: String(payload.port || ""),
        dbPath: payload.dbPath || "",
      });
      setNotes(payload.notes || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load restaurant");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadStaffUsers = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/restaurants/${id}/users`, { cache: "no-store" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to load users");
      }
      const payload = (await res.json()) as { users?: RestaurantUser[] };
      const users = Array.isArray(payload.users) ? payload.users : [];
      setStaffUsers(users);
      setEditUserRole(
        users.reduce<Record<number, string>>((acc, row) => {
          acc[row.id] = row.role || "manager";
          return acc;
        }, {}),
      );
      setEditUserName(
        users.reduce<Record<number, string>>((acc, row) => {
          acc[row.id] = row.name || "";
          return acc;
        }, {}),
      );
      setEditUserEmail(
        users.reduce<Record<number, string>>((acc, row) => {
          acc[row.id] = row.email || "";
          return acc;
        }, {}),
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load staff users", "error");
    }
  }, [id, showToast]);

  useEffect(() => {
    void loadStaffUsers();
  }, [loadStaffUsers]);

  const loadRestaurantSettings = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/restaurants/${id}/settings`, { cache: "no-store" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to load settings");
      }
      const payload = (await res.json()) as { settings?: Record<string, string> };
      const settings = payload.settings || {};

      setRestaurantSettings({
        restaurantName: settings.restaurantName || "",
        contactEmail: settings.contactEmail || "",
        replyToEmail: settings.replyToEmail || "",
        staffNotificationEmail: settings.staffNotificationEmail || "",
        staffNotificationsEnabled: boolSetting(settings.staffNotificationsEnabled ?? "true"),
        timezone: settings.timezone || "America/New_York",
        accentColor: settings.accentColor || "#1e3a5f",
        slug: settings.slug || restaurant?.slug || "",
        phone: settings.phone || "",
        address: settings.address || "",
        emailEnabled: boolSetting(settings.emailEnabled ?? "true"),
        emailSendConfirmations: boolSetting(settings.emailSendConfirmations ?? "true"),
        emailSendReminders: boolSetting(settings.emailSendReminders ?? "true"),
        emailReminderTiming: settings.emailReminderTiming || "24",
        largePartyThreshold: settings.largePartyThreshold || "8",
        tagline: settings.tagline || "",
        description: settings.description || "",
        heroImageUrl: settings.heroImageUrl || "",
        logoUrl: settings.logoUrl || "",
        faviconUrl: settings.faviconUrl || "",
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load settings", "error");
    }
  }, [id, restaurant?.slug, showToast]);

  useEffect(() => {
    void loadRestaurantSettings();
  }, [loadRestaurantSettings]);

  async function saveRestaurantSettings() {
    if (!restaurant) return;
    setBusy("save-settings");
    try {
      const payload = {
        settings: {
          restaurantName: restaurantSettings.restaurantName,
          contactEmail: restaurantSettings.contactEmail,
          replyToEmail: restaurantSettings.replyToEmail,
          staffNotificationEmail: restaurantSettings.staffNotificationEmail,
          staffNotificationsEnabled: restaurantSettings.staffNotificationsEnabled ? "true" : "false",
          timezone: restaurantSettings.timezone,
          accentColor: restaurantSettings.accentColor,
          slug: restaurantSettings.slug || restaurant.slug,
          phone: restaurantSettings.phone,
          address: restaurantSettings.address,
          emailEnabled: restaurantSettings.emailEnabled ? "true" : "false",
          emailSendConfirmations: restaurantSettings.emailSendConfirmations ? "true" : "false",
          emailSendReminders: restaurantSettings.emailSendReminders ? "true" : "false",
          emailReminderTiming: restaurantSettings.emailReminderTiming || "24",
          largePartyThreshold: restaurantSettings.largePartyThreshold || "8",
          tagline: restaurantSettings.tagline,
          description: restaurantSettings.description,
          heroImageUrl: restaurantSettings.heroImageUrl,
          logoUrl: restaurantSettings.logoUrl,
          faviconUrl: restaurantSettings.faviconUrl,
        },
      };

      const res = await fetch(`/api/restaurants/${restaurant.id}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const response = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(response?.error || "Failed to save settings");
      showToast("Restaurant settings saved.", "success");
      await loadRestaurantSettings();
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save settings", "error");
    } finally {
      setBusy("");
    }
  }

  async function saveOverview() {
    if (!restaurant) return;
    setBusy("save-overview");
    try {
      const res = await fetch(`/api/restaurants/${restaurant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: overview.name,
          domain: overview.domain,
          adminEmail: overview.adminEmail,
          ownerName: overview.ownerName,
          ownerEmail: overview.ownerEmail,
          ownerPhone: overview.ownerPhone,
          hosted: overview.hosted,
          hostingStatus: overview.hostingStatus,
          monthlyHostingActive: overview.monthlyHostingActive,
          port: Number.isFinite(Number(overview.port)) && Number(overview.port) > 0 ? Number(overview.port) : undefined,
          dbPath: overview.dbPath,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to save details");
      showToast("Restaurant details saved.", "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save details", "error");
    } finally {
      setBusy("");
    }
  }

  async function saveNotes() {
    if (!restaurant) return;
    setBusy("save-notes");
    try {
      const res = await fetch(`/api/restaurants/${restaurant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to save notes");
      showToast("Notes saved.", "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save notes", "error");
    } finally {
      setBusy("");
    }
  }

  async function toggleStatus() {
    if (!restaurant) return;
    const nextStatus = restaurant.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
    if (!window.confirm(`Set status to ${nextStatus}?`)) return;

    setBusy("status");
    try {
      const res = await fetch(`/api/restaurants/${restaurant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to update status");
      showToast(`Restaurant ${nextStatus === "ACTIVE" ? "reactivated" : "suspended"}.`, "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update status", "error");
    } finally {
      setBusy("");
    }
  }

  async function regenerateKey() {
    if (!restaurant) return;
    if (!window.confirm("Generate a new license key? The old key will stop working.")) return;

    setBusy("key");
    try {
      const res = await fetch(`/api/restaurants/${restaurant.id}/generate-key`, { method: "POST" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to regenerate key");
      showToast("License key regenerated.", "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to regenerate key", "error");
    } finally {
      setBusy("");
    }
  }

  async function loginAsRestaurant() {
    if (!restaurant) return;
    setBusy("login-as");
    try {
      const res = await fetch(`/api/restaurants/${restaurant.id}/login-as`, { method: "POST" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to generate login URL");
      if (!payload?.loginUrl) throw new Error("Missing login URL");
      window.open(payload.loginUrl, "_blank", "noopener,noreferrer");
      showToast("Login URL generated.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to generate login URL", "error");
    } finally {
      setBusy("");
    }
  }

  async function applyPlan() {
    if (!restaurant) return;
    if (planSelection === restaurant.plan) return;

    const downgrading =
      (restaurant.plan === "FULL_SUITE" && planSelection !== "FULL_SUITE") ||
      (restaurant.plan === "SERVICE_PRO" && planSelection === "CORE");

    if (downgrading && !window.confirm("Downgrades do not auto-disable add-ons. Continue?")) return;

    setBusy("plan");
    try {
      const res = await fetch(`/api/restaurants/${restaurant.id}/plan`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planSelection }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to change plan");
      showToast("Plan updated.", "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to change plan", "error");
    } finally {
      setBusy("");
    }
  }

  async function toggleAddon(addon: AddonKey, enabled: boolean) {
    if (!restaurant) return;
    setBusy(addon);
    try {
      const res = await fetch(`/api/restaurants/${restaurant.id}/addons`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [addon]: enabled }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to update add-on");

      if (payload?.restaurant) {
        setRestaurant((prev) => (prev ? { ...prev, ...payload.restaurant } : prev));
      }

      setSyncStatus((prev) => ({
        ...prev,
        [addon]: payload?.synced ? "synced" : "failed",
      }));

      if (!payload?.synced && payload?.syncError) {
        showToast(`Updated in admin DB, but sync failed: ${payload.syncError}`, "error");
      } else {
        showToast("Add-on updated.", "success");
      }

      await load();
    } catch (err) {
      setSyncStatus((prev) => ({ ...prev, [addon]: "failed" }));
      showToast(err instanceof Error ? err.message : "Failed to update add-on", "error");
    } finally {
      setBusy("");
    }
  }

  async function createStaffUser() {
    if (!restaurant) return;
    setBusy("create-user");
    try {
      const res = await fetch(`/api/restaurants/${restaurant.id}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to create user");
      setNewUser({ name: "", email: "", password: "", role: "manager" });
      setShowNewUser(false);
      showToast("Staff user created.", "success");
      await loadStaffUsers();
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to create user", "error");
    } finally {
      setBusy("");
    }
  }

  async function saveStaffUser(userId: number) {
    if (!restaurant) return;
    setBusy(`save-user-${userId}`);
    try {
      const res = await fetch(`/api/restaurants/${restaurant.id}/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editUserName[userId],
          email: editUserEmail[userId],
          role: editUserRole[userId],
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to update user");
      showToast("Staff user updated.", "success");
      await loadStaffUsers();
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update user", "error");
    } finally {
      setBusy("");
    }
  }

  async function resetStaffPassword(userId: number) {
    if (!restaurant) return;
    const password = String(resetPasswordValue[userId] || "");
    if (password.length < 8) {
      showToast("Password must be at least 8 characters.", "error");
      return;
    }

    setBusy(`reset-user-${userId}`);
    try {
      const res = await fetch(`/api/restaurants/${restaurant.id}/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to reset password");
      setResetPasswordValue((prev) => ({ ...prev, [userId]: "" }));
      showToast("Password reset.", "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to reset password", "error");
    } finally {
      setBusy("");
    }
  }

  async function deleteStaffUser(userId: number) {
    if (!restaurant) return;
    if (!window.confirm("Delete this user?")) return;

    setBusy(`delete-user-${userId}`);
    try {
      const res = await fetch(`/api/restaurants/${restaurant.id}/users/${userId}`, {
        method: "DELETE",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to delete user");
      showToast("Staff user deleted.", "success");
      await loadStaffUsers();
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete user", "error");
    } finally {
      setBusy("");
    }
  }

  async function runHealthCheck() {
    if (!restaurant) return;
    setBusy("health");
    try {
      const res = await fetch("/api/health/check-all", { cache: "no-store" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || "Health check failed");
      }
      showToast("Health check completed.", "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Health check failed", "error");
    } finally {
      setBusy("");
    }
  }

  async function resendFailedSequence(eventId: string) {
    if (!restaurant) return;
    setBusy(`resend-seq-${eventId}`);
    try {
      const res = await fetch(`/api/restaurants/${restaurant.id}/email-sequences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resendFailed", eventId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to resend email");
      showToast("Email resent.", "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to resend email", "error");
    } finally {
      setBusy("");
    }
  }

  async function cancelPendingSequences() {
    if (!restaurant) return;
    if (!window.confirm("Cancel all pending sequence emails for this restaurant?")) return;
    setBusy("cancel-sequences");
    try {
      const res = await fetch(`/api/restaurants/${restaurant.id}/email-sequences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancelPending" }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to cancel pending emails");
      showToast(`Cancelled ${payload?.cancelled || 0} pending email(s).`, "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to cancel pending emails", "error");
    } finally {
      setBusy("");
    }
  }

  async function sendManualEmail() {
    if (!restaurant) return;
    const to = manualEmailTo.trim();
    if (!to) {
      showToast("Recipient email is required.", "error");
      return;
    }

    if (selectedEmailTemplate === "custom") {
      if (!manualEmailSubject.trim()) {
        showToast("Subject is required for custom emails.", "error");
        return;
      }
      if (!manualEmailBody.trim()) {
        showToast("Body is required for custom emails.", "error");
        return;
      }
    }

    setBusy("send-manual-email");
    try {
      const payload =
        selectedEmailTemplate === "custom"
          ? {
              template: "custom",
              to,
              subject: manualEmailSubject.trim(),
              body: manualEmailBody.trim(),
            }
          : {
              template: selectedEmailTemplate,
              to,
            };

      const res = await fetch(`/api/restaurants/${restaurant.id}/email-sequences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const response = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(response?.error || "Failed to send email");
      showToast("Email sent.", "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to send email", "error");
    } finally {
      setBusy("");
    }
  }

  async function reprovisionRestaurant() {
    if (!restaurant) return;
    if (!window.confirm("Run provisioning again for this restaurant?")) return;

    setBusy("reprovision");
    try {
      const res = await fetch("/api/restaurants/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: restaurant.id }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || payload?.details || "Re-provision failed");
      showToast("Restaurant re-provisioned.", "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Re-provision failed", "error");
      await load();
    } finally {
      setBusy("");
    }
  }

  async function deleteRestaurant() {
    if (!restaurant) return;
    if (!window.confirm(`Delete ${restaurant.name}? This is destructive.`)) return;

    setBusy("delete");
    try {
      const res = await fetch(`/api/restaurants/${restaurant.id}`, { method: "DELETE" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to delete restaurant");
      showToast("Restaurant deleted.", "success");
      router.push("/dashboard/restaurants");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete restaurant", "error");
    } finally {
      setBusy("");
    }
  }

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-5">Loading restaurant...</div>;
  }

  if (error && !restaurant) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{error}</div>;
  }

  if (!restaurant) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{restaurant.name}</h1>
          <p className="text-sm text-slate-600">
            <a
              href={`https://${restaurant.domain || `${restaurant.slug}.reservesit.com`}`}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-slate-300 underline-offset-2"
            >
              {restaurant.domain || `${restaurant.slug}.reservesit.com`}
            </a>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <RestaurantStatusBadge status={restaurant.status} />
            <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${provisionStatusClass(restaurant.provisionStatus)}`}>
              Provision: {restaurant.provisionStatus || "unknown"}
            </span>
            <PlanBadge plan={restaurant.plan} />
            {healthLatest ? <HealthStatusBadge status={healthLatest.status} /> : <span className="text-xs text-slate-500">No health checks</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`https://${restaurant.domain || `${restaurant.slug}.reservesit.com`}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
          >
            Open Site
          </a>
          <Link href="/dashboard/restaurants" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700">
            Back to Restaurants
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto border-b border-slate-200">
        <div className="flex min-w-max gap-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "-mb-px border border-b-white border-slate-200 bg-white text-blue-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "Settings" ? (
      <SettingsTab
        restaurant={restaurant}
        restaurantSettings={restaurantSettings}
        setRestaurantSettings={setRestaurantSettings}
        canManage={canManage}
        TIMEZONE_OPTIONS={TIMEZONE_OPTIONS}
        saveRestaurantSettings={saveRestaurantSettings}
        busy={busy}
        onRefresh={load}
      />
      ) : null}

      {activeTab === "Overview" ? (
      <div className="space-y-4">
        <OverviewTab
          overview={overview}
          setOverview={setOverview}
          canManage={canManage}
          restaurant={restaurant}
          saveOverview={saveOverview}
          busy={busy}
          canLoginAs={canLoginAs}
          loginAsRestaurant={loginAsRestaurant}
          notes={notes}
          setNotes={setNotes}
          saveNotes={saveNotes}
          toggleStatus={toggleStatus}
          deleteRestaurant={deleteRestaurant}
          onRefresh={load}
        />
        <LicenseTab
          restaurant={restaurant}
          showKey={showKey}
          setShowKey={setShowKey}
          showToast={showToast}
          canManage={canManage}
          regenerateKey={regenerateKey}
          busy={busy}
          planSelection={planSelection}
          setPlanSelection={setPlanSelection}
          applyPlan={applyPlan}
          ADDONS={ADDONS}
          isIncludedInPlan={isIncludedInPlan}
          syncStatus={syncStatus}
          toggleAddon={toggleAddon}
          healthLatest={healthLatest}
          runHealthCheck={runHealthCheck}
          onRefresh={load}
        />
        <ProvisionTab
          restaurant={restaurant}
          provisionStatusClass={provisionStatusClass}
          showToast={showToast}
          canManage={canManage}
          reprovisionRestaurant={reprovisionRestaurant}
          busy={busy}
          showProvisionLog={showProvisionLog}
          setShowProvisionLog={setShowProvisionLog}
          onRefresh={load}
        />
      </div>
      ) : null}

      {activeTab === "Users" ? (
      <UsersTab
        staffUsers={staffUsers}
        canManage={canManage}
        showNewUser={showNewUser}
        setShowNewUser={setShowNewUser}
        newUser={newUser}
        setNewUser={setNewUser}
        createStaffUser={createStaffUser}
        busy={busy}
        editUserName={editUserName}
        setEditUserName={setEditUserName}
        editUserEmail={editUserEmail}
        setEditUserEmail={setEditUserEmail}
        editUserRole={editUserRole}
        setEditUserRole={setEditUserRole}
        resetPasswordValue={resetPasswordValue}
        setResetPasswordValue={setResetPasswordValue}
        resetStaffPassword={resetStaffPassword}
        saveStaffUser={saveStaffUser}
        deleteStaffUser={deleteStaffUser}
        onRefresh={load}
      />
      ) : null}

      {activeTab === "Emails" ? (
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Email Sequence</h2>
            <p className="text-sm text-slate-600">Post-purchase onboarding emails and delivery status.</p>
          </div>
          {canManage ? (
            <button
              type="button"
              onClick={cancelPendingSequences}
              disabled={busy === "cancel-sequences"}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
            >
              {busy === "cancel-sequences" ? "Cancelling..." : "Cancel Remaining"}
            </button>
          ) : null}
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Send Email</h3>
          <div className="flex flex-wrap gap-2">
            {EMAIL_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => setSelectedEmailTemplate(template.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedEmailTemplate === template.id
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-300 bg-white text-slate-700"
                }`}
              >
                {template.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            {EMAIL_TEMPLATES.find((template) => template.id === selectedEmailTemplate)?.description}
          </p>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">To</span>
            <input
              value={manualEmailTo}
              onChange={(e) => setManualEmailTo(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
            />
          </label>

          {selectedEmailTemplate === "custom" ? (
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</span>
                <input
                  value={manualEmailSubject}
                  onChange={(e) => setManualEmailSubject(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Body</span>
                <textarea
                  value={manualEmailBody}
                  onChange={(e) => setManualEmailBody(e.target.value)}
                  rows={6}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="font-medium text-slate-900">{manualEmailSubject}</div>
              <div className="mt-1 whitespace-pre-line text-slate-600">
                {manualEmailBody
                  .split("\n")
                  .filter((line) => line.trim().length > 0)
                  .slice(0, 2)
                  .join("\n")}
              </div>
            </div>
          )}

          <div className="flex">
            <button
              type="button"
              onClick={sendManualEmail}
              disabled={busy === "send-manual-email"}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy === "send-manual-email" ? "Sending..." : "Send Now"}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <span className="font-medium">{emailSummary.queued}</span> queued,{" "}
          <span className="font-medium">{emailSummary.sent}</span> sent,{" "}
          <span className="font-medium">{emailSummary.failed}</span> failed.
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Step</th>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Scheduled</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Sent</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {restaurant.emailSequences.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-slate-500" colSpan={6}>No email sequence events found.</td>
                </tr>
              ) : (
                restaurant.emailSequences.map((event) => (
                  <tr key={event.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-700">{event.sequenceStep}</td>
                    <td className="px-3 py-2 text-slate-900">
                      <div className="font-medium">{event.emailSubject}</div>
                      <div className="text-xs text-slate-500">{event.emailTo}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{formatDateTime(event.scheduledAt)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${sequenceStatusClass(event.status)}`}>
                        {event.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{formatDateTime(event.sentAt) || "-"}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        {canManage && event.status === "failed" ? (
                          <button
                            type="button"
                            onClick={() => void resendFailedSequence(event.id)}
                            disabled={busy === `resend-seq-${event.id}`}
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-60"
                          >
                            {busy === `resend-seq-${event.id}` ? "Sending..." : "Resend"}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      ) : null}

      {activeTab === "Activity" ? (
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Health History (last 50)</h2>
          </div>
          <div className="max-h-80 overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2">Checked</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Response</th>
                </tr>
              </thead>
              <tbody>
                {restaurant.healthChecks.length === 0 ? (
                  <tr><td className="px-4 py-4 text-slate-500" colSpan={3}>No records.</td></tr>
                ) : (
                  restaurant.healthChecks.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="px-4 py-2 text-slate-700">{formatDateTime(row.checkedAt)}</td>
                      <td className="px-4 py-2"><HealthStatusBadge status={row.status} /></td>
                      <td className="px-4 py-2 text-slate-700">{row.responseTimeMs ?? "-"} ms</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">License Event Log</h2>
          </div>
          <div className="max-h-80 overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2">When</th>
                  <th className="px-4 py-2">Event</th>
                  <th className="px-4 py-2">By</th>
                </tr>
              </thead>
              <tbody>
                {restaurant.licenseEvents.length === 0 ? (
                  <tr><td className="px-4 py-4 text-slate-500" colSpan={3}>No events.</td></tr>
                ) : (
                  restaurant.licenseEvents.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="px-4 py-2 text-slate-700">{formatDateTime(row.createdAt)}</td>
                      <td className="px-4 py-2 text-slate-900">
                        {row.event.replaceAll("_", " ")}
                        {row.details ? <div className="text-xs text-slate-500">{row.details}</div> : null}
                      </td>
                      <td className="px-4 py-2 text-slate-700">{row.performedBy || "system"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      ) : null}
    </div>
  );
}
