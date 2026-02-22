"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AccessDenied from "@/components/access-denied";
import {
  ALL_PERMISSIONS,
  getRoleDefaultPermissions,
  getUserPermissions,
  type PermissionKey,
} from "@/lib/permissions";
import { useHasPermission } from "@/hooks/use-permissions";

type Role = "superadmin" | "admin" | "manager" | "host";
type AssignableRole = Exclude<Role, "superadmin">;

interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: Role;
  permissions: string | null;
  isActive: boolean;
  createdAt: string;
}

interface OverviewData {
  today: string;
  stats: {
    usersTotal: number;
    usersActive: number;
    reservationsTotal: number;
    reservationsToday: number;
    guestsTotal: number;
    tablesTotal: number;
    pendingCount: number;
    settingsCount: number;
  };
  features: Record<string, boolean>;
  restaurant: {
    name: string;
    phone: string;
    address: string;
    timezone: string;
    openTime: string;
    closeTime: string;
  };
}

const ASSIGNABLE_ROLES: AssignableRole[] = ["admin", "manager", "host"];
const ROLE_LABEL: Record<Role, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  host: "Host",
};

const FEATURE_PERMISSIONS: Partial<Record<PermissionKey, string>> = {
  view_reports: "reporting",
  view_guests: "guest_history",
  manage_events: "event_ticketing",
};

function fmtDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function splitByCategory(permissionKeys: PermissionKey[]) {
  const byCategory: Record<string, PermissionKey[]> = {};
  for (const key of permissionKeys) {
    const permission = ALL_PERMISSIONS.find((entry) => entry.key === key);
    if (!permission) continue;
    if (!byCategory[permission.category]) byCategory[permission.category] = [];
    byCategory[permission.category].push(key);
  }
  return byCategory;
}

function asSortedPermissions(items: Iterable<PermissionKey>): PermissionKey[] {
  const set = new Set(items);
  const result: PermissionKey[] = [];
  for (const permission of ALL_PERMISSIONS) {
    if (set.has(permission.key)) result.push(permission.key);
  }
  return result;
}

export default function AdminPage() {
  const canManageStaff = useHasPermission("manage_staff");
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [creating, setCreating] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState<number | null>(null);

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<AssignableRole>("host");
  const [newPermissions, setNewPermissions] = useState<PermissionKey[]>(() => asSortedPermissions(getRoleDefaultPermissions("host")));
  const [showCreatePermissions, setShowCreatePermissions] = useState(false);

  const [permissionDrafts, setPermissionDrafts] = useState<Record<number, PermissionKey[]>>({});
  const [showUserPermissions, setShowUserPermissions] = useState<Record<number, boolean>>({});

  const roleBadge: Record<Role, string> = useMemo(
    () => ({
      superadmin: "bg-purple-100 text-purple-700",
      admin: "bg-blue-100 text-blue-700",
      manager: "bg-emerald-100 text-emerald-700",
      host: "bg-gray-100 text-gray-700",
    }),
    [],
  );

  const availablePermissions = useMemo(() => {
    const features = overview?.features || {};
    return ALL_PERMISSIONS.filter((permission) => {
      const feature = FEATURE_PERMISSIONS[permission.key];
      if (!feature) return true;
      return features[feature] === true;
    }).map((permission) => permission.key);
  }, [overview]);

  const permissionSections = useMemo(() => splitByCategory(availablePermissions), [availablePermissions]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [overviewRes, usersRes] = await Promise.all([
        fetch("/api/admin/overview"),
        fetch("/api/admin/users"),
      ]);

      if (overviewRes.status === 403 || usersRes.status === 403) {
        setMessage("You do not have permission to manage staff accounts.");
        setOverview(null);
        setUsers([]);
        return;
      }

      if (!overviewRes.ok || !usersRes.ok) {
        const [overviewPayload, usersPayload] = await Promise.all([
          overviewRes.json().catch(() => ({})),
          usersRes.json().catch(() => ({})),
        ]);
        const overviewError = String((overviewPayload as { error?: string })?.error || "");
        const usersError = String((usersPayload as { error?: string })?.error || "");
        throw new Error(overviewError || usersError || "Failed to load staff settings.");
      }

      const [overviewData, usersData] = await Promise.all([
        overviewRes.json(),
        usersRes.json(),
      ]);

      const nextUsers = Array.isArray(usersData) ? (usersData as AdminUser[]) : [];
      setOverview((overviewData || null) as OverviewData | null);
      setUsers(nextUsers);
      setPermissionDrafts(() => {
        const drafts: Record<number, PermissionKey[]> = {};
        for (const user of nextUsers) {
          drafts[user.id] = asSortedPermissions(getUserPermissions(user.role, user.permissions));
        }
        return drafts;
      });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load admin data.");
      setOverview(null);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canManageStaff) {
      setLoading(false);
      return;
    }
    load().catch(() => undefined);
  }, [canManageStaff, load]);

  useEffect(() => {
    const defaults = asSortedPermissions(getRoleDefaultPermissions(newRole));
    setNewPermissions(defaults.filter((key) => availablePermissions.includes(key)));
  }, [newRole, availablePermissions]);

  function toggleCreatePermission(key: PermissionKey) {
    setNewPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      next.add("view_dashboard");
      return asSortedPermissions(next).filter((entry) => availablePermissions.includes(entry));
    });
  }

  function toggleUserPermission(userId: number, key: PermissionKey) {
    setPermissionDrafts((prev) => {
      const next = new Set(prev[userId] || []);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      next.add("view_dashboard");
      return { ...prev, [userId]: asSortedPermissions(next).filter((entry) => availablePermissions.includes(entry)) };
    });
  }

  function toggleUserPermissionsPanel(userId: number) {
    setShowUserPermissions((prev) => ({ ...prev, [userId]: !prev[userId] }));
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          password: newPassword,
          role: newRole,
          permissions: newPermissions,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Failed to create user.");
        return;
      }
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("host");
      setMessage(`Created user ${data.email}.`);
      await load();
    } catch {
      setMessage("Failed to create user.");
    } finally {
      setCreating(false);
    }
  }

  async function updateUser(user: AdminUser, patch: Partial<{ role: Role; isActive: boolean; password: string; permissions: PermissionKey[] }>) {
    setMessage("");
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(String((data as { error?: string })?.error || "Failed to update user."));
        return;
      }
      setMessage(`Updated ${(data as { email?: string }).email || user.email}.`);
      await load();
    } catch {
      setMessage("Failed to update user.");
    }
  }

  async function saveUserPermissions(user: AdminUser) {
    const selected = permissionDrafts[user.id] || [];
    setSavingPermissions(user.id);
    try {
      await updateUser(user, { permissions: selected });
    } finally {
      setSavingPermissions(null);
    }
  }

  if (!canManageStaff) {
    return <AccessDenied />;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-gray-500">
        <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
        Loading staff settings...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Staff Permissions</h1>
        <p className="text-sm text-gray-500">Role defaults with per-user permission overrides.</p>
      </div>

      {loadError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => load()}
            className="h-9 rounded border border-red-200 bg-white px-3 text-xs font-medium text-red-700"
          >
            Retry
          </button>
        </div>
      ) : null}

      {message && <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">{message}</div>}

      {overview && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border p-4"><div className="text-xs text-gray-500">Users</div><div className="text-2xl font-bold">{overview.stats.usersTotal}</div><div className="text-xs text-gray-400">{overview.stats.usersActive} active</div></div>
            <div className="bg-white rounded-xl border p-4"><div className="text-xs text-gray-500">Reservations</div><div className="text-2xl font-bold">{overview.stats.reservationsTotal}</div><div className="text-xs text-gray-400">{overview.stats.reservationsToday} today</div></div>
            <div className="bg-white rounded-xl border p-4"><div className="text-xs text-gray-500">Guests</div><div className="text-2xl font-bold">{overview.stats.guestsTotal}</div><div className="text-xs text-gray-400">{overview.stats.pendingCount} pending</div></div>
            <div className="bg-white rounded-xl border p-4"><div className="text-xs text-gray-500">Tables</div><div className="text-2xl font-bold">{overview.stats.tablesTotal}</div><div className="text-xs text-gray-400">{overview.stats.settingsCount} settings</div></div>
          </div>

          <div className="bg-white rounded-xl border p-4">
            <h2 className="font-semibold mb-2">Restaurant Profile</h2>
            <div className="text-sm text-gray-700">{overview.restaurant.name}</div>
            <div className="text-sm text-gray-500">{overview.restaurant.phone || "No phone"} · {overview.restaurant.timezone}</div>
            <div className="text-sm text-gray-500">{overview.restaurant.address || "No address configured"}</div>
            <div className="text-sm text-gray-500">Hours: {overview.restaurant.openTime} - {overview.restaurant.closeTime}</div>
          </div>
        </>
      )}

      <div className="bg-white rounded-xl border p-4">
        <h2 className="font-semibold mb-3">Create User</h2>
        <form onSubmit={createUser} className="space-y-3">
          <div className="grid md:grid-cols-4 gap-3">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full name" className="h-11 border rounded px-3 text-sm" required />
            <input value={newEmail} onChange={e => setNewEmail(e.target.value)} type="email" placeholder="email@restaurant.com" className="h-11 border rounded px-3 text-sm" required />
            <input value={newPassword} onChange={e => setNewPassword(e.target.value)} type="password" placeholder="Password (min 8)" className="h-11 border rounded px-3 text-sm" required />
            <select
              value={newRole}
              onChange={e => setNewRole(e.target.value as AssignableRole)}
              className="h-11 border rounded px-3 text-sm"
            >
              {ASSIGNABLE_ROLES.map(role => <option key={role} value={role}>{ROLE_LABEL[role]}</option>)}
            </select>
          </div>

          <div className="rounded-lg border p-3 space-y-3">
            <button
              type="button"
              onClick={() => setShowCreatePermissions((prev) => !prev)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <span>Custom Permissions</span>
              <span className="flex items-center gap-2 text-gray-500">
                <span className="text-xs">{showCreatePermissions ? "Hide" : "Show"} permission overrides</span>
                <span className="text-lg">{showCreatePermissions ? "▲" : "▼"}</span>
              </span>
            </button>
            {!showCreatePermissions && (
              <p className="text-xs text-gray-400 mt-1 ml-1">
                Using default permissions for selected role. Click to customize.
              </p>
            )}
            {showCreatePermissions && (
              <div className="space-y-3">
                {Object.entries(permissionSections).map(([category, keys]) => (
                  <div key={category}>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{category}</div>
                    <div className="grid gap-2 md:grid-cols-2">
                      {keys.map((key) => {
                        const permission = ALL_PERMISSIONS.find((entry) => entry.key === key);
                        if (!permission) return null;
                        const defaults = getRoleDefaultPermissions(newRole);
                        const isDefault = defaults.has(key);
                        const checked = newPermissions.includes(key);
                        const disabled = key === "view_dashboard" || newRole === "admin";
                        return (
                          <label key={key} className="flex items-start gap-2 rounded border p-2 text-sm">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCreatePermission(key)}
                              disabled={disabled}
                              className="mt-0.5 h-4 w-4"
                            />
                            <span>
                              <span className="font-medium">{permission.label}</span>
                              {isDefault ? <span className="ml-2 text-xs text-gray-500">(default)</span> : null}
                              {permission.description ? <span className="block text-xs text-gray-500">{permission.description}</span> : null}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button disabled={creating} className="h-11 w-full rounded bg-blue-600 text-white text-sm font-medium transition-all duration-200 disabled:opacity-60">
            {creating ? "Creating..." : "Create User"}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border p-4">
        <h2 className="font-semibold mb-3">Users</h2>
        <div className="space-y-3">
          {users.map(user => {
            const defaults = getRoleDefaultPermissions(user.role);
            const selected = permissionDrafts[user.id] || [];
            const canEditOverrides = user.role !== "admin" && user.role !== "superadmin";

            return (
              <div key={user.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{user.name}</div>
                    <div className="text-xs text-gray-500">{user.email}</div>
                    <div className="text-xs text-gray-400">Created {fmtDate(user.createdAt)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${roleBadge[user.role]}`}>{ROLE_LABEL[user.role]}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${user.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                      {user.isActive ? "active" : "inactive"}
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid sm:grid-cols-3 gap-2">
                  {user.role === "superadmin" ? (
                    <select
                      value={user.role}
                      disabled
                      className="h-10 border rounded px-3 text-sm bg-gray-50 text-gray-500"
                    >
                      <option value="superadmin">{ROLE_LABEL.superadmin}</option>
                    </select>
                  ) : (
                    <select
                      value={user.role}
                      onChange={e => {
                        const nextRole = e.target.value as AssignableRole;
                        const defaultPermissions = asSortedPermissions(getRoleDefaultPermissions(nextRole)).filter((key) => availablePermissions.includes(key));
                        updateUser(user, { role: nextRole, permissions: defaultPermissions });
                      }}
                      className="h-10 border rounded px-3 text-sm"
                    >
                      {ASSIGNABLE_ROLES.map(role => <option key={role} value={role}>{ROLE_LABEL[role]}</option>)}
                    </select>
                  )}
                  <button
                    onClick={() => updateUser(user, { isActive: !user.isActive })}
                    className="h-10 border rounded px-3 text-sm transition-all duration-200"
                  >
                    {user.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => {
                      const next = prompt(`Set new password for ${user.email} (min 8 chars):`);
                      if (!next) return;
                      updateUser(user, { password: next });
                    }}
                    className="h-10 border rounded px-3 text-sm transition-all duration-200"
                  >
                    Reset Password
                  </button>
                </div>

                <div className="mt-4 rounded-lg border p-3 space-y-3">
                  <button
                    type="button"
                    onClick={() => toggleUserPermissionsPanel(user.id)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <span>Permissions</span>
                    <span className="flex items-center gap-2 text-gray-500">
                      <span className="text-xs">{showUserPermissions[user.id] ? "Hide" : "Show"} permission overrides</span>
                      <span className="text-lg">{showUserPermissions[user.id] ? "▲" : "▼"}</span>
                    </span>
                  </button>

                  {!showUserPermissions[user.id] && (
                    <p className="text-xs text-gray-400 mt-1 ml-1">
                      Using saved permissions for this user. Expand to view or edit.
                    </p>
                  )}

                  {showUserPermissions[user.id] && (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold">Permissions</h3>
                        {canEditOverrides ? (
                          <button
                            type="button"
                            onClick={() => saveUserPermissions(user)}
                            disabled={savingPermissions === user.id}
                            className="h-9 rounded bg-blue-600 px-3 text-xs font-medium text-white disabled:opacity-60"
                          >
                            {savingPermissions === user.id ? "Saving..." : "Save Permissions"}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-500">Admin roles always have full access.</span>
                        )}
                      </div>

                      {Object.entries(permissionSections).map(([category, keys]) => (
                        <div key={`${user.id}-${category}`}>
                          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{category}</div>
                          <div className="grid gap-2 md:grid-cols-2">
                            {keys.map((key) => {
                              const permission = ALL_PERMISSIONS.find((entry) => entry.key === key);
                              if (!permission) return null;
                              const isDefault = defaults.has(key);
                              const checked = selected.includes(key);
                              const disabled = key === "view_dashboard" || !canEditOverrides;
                              return (
                                <label key={`${user.id}-${key}`} className="flex items-start gap-2 rounded border p-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={disabled}
                                    onChange={() => toggleUserPermission(user.id, key)}
                                    className="mt-0.5 h-4 w-4"
                                  />
                                  <span>
                                    <span className="font-medium">{permission.label}</span>
                                    {isDefault ? <span className="ml-2 text-xs text-gray-500">(default)</span> : null}
                                    {permission.description ? <span className="block text-xs text-gray-500">{permission.description}</span> : null}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {users.length === 0 && <div className="text-sm text-gray-500">No users found.</div>}
        </div>
      </div>
    </div>
  );
}
