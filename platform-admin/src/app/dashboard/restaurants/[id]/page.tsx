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
import { formatDate, formatDateTime } from "@/lib/format";
import { HealthStatusBadge, HostingStatusBadge, PlanBadge, RestaurantStatusBadge } from "@/components/status-badge";

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
  const [showKey, setShowKey] = useState(false);
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

  const canManage = useMemo(() => user.role === "ADMIN" || user.role === "SUPER_ADMIN", [user.role]);
  const canLoginAs = user.role === "SUPER_ADMIN";
  const healthLatest = restaurant?.healthChecks?.[0] || null;

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
          <p className="text-sm text-slate-600">{restaurant.domain || `${restaurant.slug}.reservesit.com`}</p>
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
            Back
          </Link>
        </div>
      </div>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Restaurant Settings</h2>
          <p className="text-sm text-slate-600">Manage onboarding and communication settings for this restaurant instance.</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Email Overview</h3>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <div className="grid gap-1 sm:grid-cols-[140px_1fr]">
              <span className="font-medium text-slate-500">Guests see:</span>
              <span>{`${restaurantSettings.restaurantName || restaurant.name} <reservations@reservesit.com>`}</span>
            </div>
            <div className="grid gap-1 sm:grid-cols-[140px_1fr]">
              <span className="font-medium text-slate-500">Replies go to:</span>
              <span>{restaurantSettings.replyToEmail || "Not configured"}</span>
            </div>
            <div className="grid gap-1 sm:grid-cols-[140px_1fr]">
              <span className="font-medium text-slate-500">Alerts go to:</span>
              <span>{restaurantSettings.staffNotificationEmail || "Not configured"}</span>
            </div>
            <div className="grid gap-1 sm:grid-cols-[140px_1fr]">
              <span className="font-medium text-slate-500">Public email:</span>
              <span>{restaurantSettings.contactEmail || "Not configured"}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Email Configuration</h3>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Notification Email</span>
              <input
                value={restaurantSettings.staffNotificationEmail}
                onChange={(e) => setRestaurantSettings((prev) => ({ ...prev, staffNotificationEmail: e.target.value }))}
                disabled={!canManage}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100"
              />
              <span className="mt-1 block text-xs text-slate-500">New reservations, cancellations, and large party alerts go here.</span>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Reply-To Email</span>
              <input
                value={restaurantSettings.replyToEmail}
                onChange={(e) => setRestaurantSettings((prev) => ({ ...prev, replyToEmail: e.target.value }))}
                disabled={!canManage}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100"
              />
              <span className="mt-1 block text-xs text-slate-500">When guests reply to confirmation emails, replies are sent here.</span>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Contact Email</span>
              <input
                value={restaurantSettings.contactEmail}
                onChange={(e) => setRestaurantSettings((prev) => ({ ...prev, contactEmail: e.target.value }))}
                disabled={!canManage}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100"
              />
              <span className="mt-1 block text-xs text-slate-500">Shown publicly on the restaurant website.</span>
            </label>

            <div className="grid gap-2 md:grid-cols-2">
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={restaurantSettings.staffNotificationsEnabled}
                  disabled={!canManage}
                  onChange={(e) =>
                    setRestaurantSettings((prev) => ({ ...prev, staffNotificationsEnabled: e.target.checked }))
                  }
                />
                Staff notifications enabled
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={restaurantSettings.emailEnabled}
                  disabled={!canManage}
                  onChange={(e) => setRestaurantSettings((prev) => ({ ...prev, emailEnabled: e.target.checked }))}
                />
                Email enabled
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={restaurantSettings.emailSendConfirmations}
                  disabled={!canManage}
                  onChange={(e) =>
                    setRestaurantSettings((prev) => ({ ...prev, emailSendConfirmations: e.target.checked }))
                  }
                />
                Send confirmations
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={restaurantSettings.emailSendReminders}
                  disabled={!canManage}
                  onChange={(e) =>
                    setRestaurantSettings((prev) => ({ ...prev, emailSendReminders: e.target.checked }))
                  }
                />
                Send reminders
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Large Party Threshold</span>
                <input
                  type="number"
                  min={1}
                  value={restaurantSettings.largePartyThreshold}
                  onChange={(e) =>
                    setRestaurantSettings((prev) => ({ ...prev, largePartyThreshold: e.target.value }))
                  }
                  disabled={!canManage}
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Reminder Timing</span>
                <select
                  value={restaurantSettings.emailReminderTiming}
                  onChange={(e) =>
                    setRestaurantSettings((prev) => ({ ...prev, emailReminderTiming: e.target.value }))
                  }
                  disabled={!canManage}
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100"
                >
                  <option value="2">2 hours</option>
                  <option value="4">4 hours</option>
                  <option value="24">24 hours</option>
                </select>
              </label>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Restaurant Identity</h3>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Restaurant Name</span>
              <input
                value={restaurantSettings.restaurantName}
                onChange={(e) => setRestaurantSettings((prev) => ({ ...prev, restaurantName: e.target.value }))}
                disabled={!canManage}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</span>
              <input
                value={restaurantSettings.phone}
                onChange={(e) => setRestaurantSettings((prev) => ({ ...prev, phone: e.target.value }))}
                disabled={!canManage}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Address</span>
              <input
                value={restaurantSettings.address}
                onChange={(e) => setRestaurantSettings((prev) => ({ ...prev, address: e.target.value }))}
                disabled={!canManage}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Timezone</span>
                <select
                  value={restaurantSettings.timezone}
                  onChange={(e) => setRestaurantSettings((prev) => ({ ...prev, timezone: e.target.value }))}
                  disabled={!canManage}
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100"
                >
                  {TIMEZONE_OPTIONS.map((timezone) => (
                    <option key={timezone} value={timezone}>
                      {timezone}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Accent Color</span>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={restaurantSettings.accentColor || "#1e3a5f"}
                    onChange={(e) => setRestaurantSettings((prev) => ({ ...prev, accentColor: e.target.value }))}
                    disabled={!canManage}
                    className="h-10 w-14 rounded-lg border border-slate-300 bg-white p-1 disabled:bg-slate-100"
                  />
                  <input
                    value={restaurantSettings.accentColor}
                    onChange={(e) => setRestaurantSettings((prev) => ({ ...prev, accentColor: e.target.value }))}
                    disabled={!canManage}
                    className="h-10 flex-1 rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100"
                  />
                </div>
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Tagline</span>
              <input
                value={restaurantSettings.tagline}
                onChange={(e) => setRestaurantSettings((prev) => ({ ...prev, tagline: e.target.value }))}
                disabled={!canManage}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Description</span>
              <textarea
                value={restaurantSettings.description}
                onChange={(e) => setRestaurantSettings((prev) => ({ ...prev, description: e.target.value }))}
                disabled={!canManage}
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              />
            </label>
          </div>
        </div>

        {canManage ? (
          <div className="flex">
            <button
              type="button"
              onClick={saveRestaurantSettings}
              disabled={busy === "save-settings"}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy === "save-settings" ? "Saving..." : "Save Restaurant Settings"}
            </button>
          </div>
        ) : null}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Restaurant Overview</h2>
            <p className="text-sm text-slate-600">Name, owner contact, and instance metadata.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Name</span>
              <input value={overview.name} onChange={(e) => setOverview((p) => ({ ...p, name: e.target.value }))} disabled={!canManage} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Domain</span>
              <input value={overview.domain} onChange={(e) => setOverview((p) => ({ ...p, domain: e.target.value }))} disabled={!canManage} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Owner Name</span>
              <input value={overview.ownerName} onChange={(e) => setOverview((p) => ({ ...p, ownerName: e.target.value }))} disabled={!canManage} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Owner Email</span>
              <input value={overview.ownerEmail} onChange={(e) => setOverview((p) => ({ ...p, ownerEmail: e.target.value }))} disabled={!canManage} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Owner Phone</span>
              <input value={overview.ownerPhone} onChange={(e) => setOverview((p) => ({ ...p, ownerPhone: e.target.value }))} disabled={!canManage} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Admin Email</span>
              <input value={overview.adminEmail} onChange={(e) => setOverview((p) => ({ ...p, adminEmail: e.target.value }))} disabled={!canManage} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Port</span>
              <input value={overview.port} onChange={(e) => setOverview((p) => ({ ...p, port: e.target.value }))} disabled={!canManage} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">DB Path</span>
              <input value={overview.dbPath} onChange={(e) => setOverview((p) => ({ ...p, dbPath: e.target.value }))} disabled={!canManage} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100" />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <PlanBadge plan={restaurant.plan} />
            <RestaurantStatusBadge status={restaurant.status} />
            <HostingStatusBadge status={restaurant.hostingStatus} />
            <span className="text-slate-600">Created {formatDate(restaurant.createdAt)}</span>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={overview.hosted} disabled={!canManage} onChange={(e) => setOverview((p) => ({ ...p, hosted: e.target.checked }))} />
              Hosted
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={overview.monthlyHostingActive} disabled={!canManage} onChange={(e) => setOverview((p) => ({ ...p, monthlyHostingActive: e.target.checked }))} />
              Monthly billing active
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Hosting Status</span>
              <select value={overview.hostingStatus} disabled={!canManage} onChange={(e) => setOverview((p) => ({ ...p, hostingStatus: e.target.value }))} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100">
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="SELF_HOSTED">SELF_HOSTED</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            {canManage ? (
              <button
                type="button"
                onClick={saveOverview}
                disabled={busy === "save-overview"}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy === "save-overview" ? "Saving..." : "Save Overview"}
              </button>
            ) : null}
            {canLoginAs ? (
              <button
                type="button"
                onClick={loginAsRestaurant}
                disabled={busy === "login-as"}
                className="rounded-lg border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-900 disabled:opacity-60"
              >
                {busy === "login-as" ? "Generating..." : "Login to Dashboard ->"}
              </button>
            ) : null}
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">License Management</h2>
            <p className="text-sm text-slate-600">Control key lifecycle and audit trail.</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">License Key</div>
            <div className="mt-1 break-all font-mono text-xs text-slate-900">{showKey ? restaurant.licenseKey : `${restaurant.licenseKey.slice(0, 8)}••••••••${restaurant.licenseKey.slice(-6)}`}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => setShowKey((v) => !v)} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold">
                {showKey ? "Hide" : "Reveal"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(restaurant.licenseKey);
                  showToast("License key copied.", "success");
                }}
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold"
              >
                Copy
              </button>
              {canManage ? (
                <button
                  type="button"
                  onClick={regenerateKey}
                  disabled={busy === "key"}
                  className="rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 disabled:opacity-60"
                >
                  {busy === "key" ? "Generating..." : "Regenerate Key"}
                </button>
              ) : null}
            </div>
          </div>

          <div className="text-xs text-slate-600">
            <div>Activated: {formatDateTime(restaurant.licenseActivatedAt) || "-"}</div>
            <div>Expires: {formatDate(restaurant.licenseExpiry) || "No expiry"}</div>
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Plan & Add-ons</h2>
              <p className="text-sm text-slate-600">Change plan tiers and control feature access.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Plan</span>
              <select value={planSelection} onChange={(e) => setPlanSelection(e.target.value as RestaurantPlan)} disabled={!canManage} className="h-10 rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100">
                <option value="CORE">CORE</option>
                <option value="SERVICE_PRO">SERVICE PRO</option>
                <option value="FULL_SUITE">FULL SUITE</option>
              </select>
            </label>
            {canManage ? (
              <button
                type="button"
                onClick={applyPlan}
                disabled={busy === "plan" || planSelection === restaurant.plan}
                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold disabled:opacity-60"
              >
                {busy === "plan" ? "Applying..." : "Apply Plan"}
              </button>
            ) : null}
          </div>

          <div className="space-y-2">
            {ADDONS.map((addon) => {
              const value = Boolean(restaurant[addon.key]);
              const included = isIncludedInPlan(restaurant.plan, addon.key);
              const sync = syncStatus[addon.key];
              return (
                <div key={addon.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{addon.label}</div>
                    <div className="text-xs text-slate-500">
                      {addon.price}
                      {included ? " · Included in plan" : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {sync === "synced" ? <span className="text-xs text-emerald-700">Synced</span> : null}
                    {sync === "failed" ? <span className="text-xs text-rose-700">Sync failed</span> : null}
                    <button
                      type="button"
                      disabled={!canManage || busy === addon.key}
                      onClick={() => void toggleAddon(addon.key, !value)}
                      className={`relative h-7 w-12 rounded-full transition-all duration-200 ${value ? "bg-emerald-500" : "bg-slate-300"} disabled:opacity-60`}
                    >
                      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all duration-200 ${value ? "left-5" : "left-0.5"}`} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Hosting & Instance</h2>
            <p className="text-sm text-slate-600">Runtime state and health checks for this customer instance.</p>
          </div>

          <div className="space-y-2 text-sm text-slate-700">
            <div>URL: <a className="text-sky-700 underline" href={`https://${restaurant.domain || `${restaurant.slug}.reservesit.com`}`} target="_blank" rel="noreferrer">{restaurant.domain || `${restaurant.slug}.reservesit.com`}</a></div>
            <div>Port: {restaurant.port}</div>
            <div className="flex items-center gap-2">Hosting status: <HostingStatusBadge status={restaurant.hostingStatus} /></div>
          </div>

          <div className="rounded-xl border border-slate-200 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last Health Check</div>
            {healthLatest ? (
              <div className="mt-2 space-y-1 text-sm text-slate-700">
                <div className="flex items-center gap-2"><HealthStatusBadge status={healthLatest.status} /> <span>{formatDateTime(healthLatest.checkedAt)}</span></div>
                <div>Response: {healthLatest.responseTimeMs ?? "-"} ms</div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No checks recorded yet.</p>
            )}
          </div>

          <button
            type="button"
            onClick={runHealthCheck}
            disabled={busy === "health"}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {busy === "health" ? "Running..." : "Health Check"}
          </button>
        </section>
      </div>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Staff Accounts</h2>
            <p className="text-sm text-slate-600">{staffUsers.length} user(s) in restaurant database.</p>
          </div>
          {canManage ? (
            <button
              type="button"
              onClick={() => setShowNewUser((prev) => !prev)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
            >
              {showNewUser ? "Close" : "Add User"}
            </button>
          ) : null}
        </div>

        {showNewUser && canManage ? (
          <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-5">
            <input
              value={newUser.name}
              onChange={(e) => setNewUser((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Name"
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
            />
            <input
              value={newUser.email}
              onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="Email"
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
            />
            <input
              value={newUser.password}
              onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="Password"
              type="password"
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
            />
            <select
              value={newUser.role}
              onChange={(e) => setNewUser((prev) => ({ ...prev, role: e.target.value }))}
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
            >
              <option value="admin">ADMIN</option>
              <option value="manager">MANAGER</option>
              <option value="host">HOST</option>
            </select>
            <button
              type="button"
              onClick={createStaffUser}
              disabled={busy === "create-user"}
              className="h-10 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy === "create-user" ? "Creating..." : "Create"}
            </button>
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Password Reset</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staffUsers.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-slate-500" colSpan={6}>No staff users found.</td>
                </tr>
              ) : (
                staffUsers.map((staffUser) => (
                  <tr key={staffUser.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      {canManage ? (
                        <input
                          value={editUserName[staffUser.id] || ""}
                          onChange={(e) => setEditUserName((prev) => ({ ...prev, [staffUser.id]: e.target.value }))}
                          className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm"
                        />
                      ) : (
                        <span>{staffUser.name}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {canManage ? (
                        <input
                          value={editUserEmail[staffUser.id] || ""}
                          onChange={(e) => setEditUserEmail((prev) => ({ ...prev, [staffUser.id]: e.target.value }))}
                          className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm"
                        />
                      ) : (
                        <span>{staffUser.email}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {canManage ? (
                        <select
                          value={editUserRole[staffUser.id] || "manager"}
                          onChange={(e) => setEditUserRole((prev) => ({ ...prev, [staffUser.id]: e.target.value }))}
                          className="h-9 rounded-lg border border-slate-300 px-2 text-sm"
                        >
                          <option value="admin">ADMIN</option>
                          <option value="manager">MANAGER</option>
                          <option value="host">HOST</option>
                        </select>
                      ) : (
                        <span className="uppercase">{staffUser.role}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{formatDate(staffUser.createdAt)}</td>
                    <td className="px-3 py-2">
                      {canManage ? (
                        <div className="flex gap-1">
                          <input
                            type="password"
                            value={resetPasswordValue[staffUser.id] || ""}
                            onChange={(e) => setResetPasswordValue((prev) => ({ ...prev, [staffUser.id]: e.target.value }))}
                            placeholder="New password"
                            className="h-9 rounded-lg border border-slate-300 px-2 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => void resetStaffPassword(staffUser.id)}
                            disabled={busy === `reset-user-${staffUser.id}`}
                            className="rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold disabled:opacity-60"
                          >
                            {busy === `reset-user-${staffUser.id}` ? "..." : "Reset"}
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {canManage ? (
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => void saveStaffUser(staffUser.id)}
                            disabled={busy === `save-user-${staffUser.id}`}
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold disabled:opacity-60"
                          >
                            {busy === `save-user-${staffUser.id}` ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteStaffUser(staffUser.id)}
                            disabled={busy === `delete-user-${staffUser.id}`}
                            className="rounded-lg border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-800 disabled:opacity-60"
                          >
                            {busy === `delete-user-${staffUser.id}` ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400">Read only</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

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

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Notes</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={saveNotes}
            disabled={busy === "save-notes"}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy === "save-notes" ? "Saving..." : "Save Notes"}
          </button>

          {canManage ? (
            <button
              type="button"
              onClick={toggleStatus}
              disabled={busy === "status"}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
            >
              {busy === "status" ? "Updating..." : restaurant.status === "SUSPENDED" ? "Reactivate" : "Suspend"}
            </button>
          ) : null}

          {canManage ? (
            <button
              type="button"
              onClick={deleteRestaurant}
              disabled={busy === "delete"}
              className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800 disabled:opacity-60"
            >
              {busy === "delete" ? "Deleting..." : "Delete Restaurant"}
            </button>
          ) : null}
        </div>
      </section>

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
    </div>
  );
}
