"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

type Role = "superadmin" | "admin" | "manager" | "host";

interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: Role;
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
  restaurant: {
    name: string;
    phone: string;
    address: string;
    timezone: string;
    openTime: string;
    closeTime: string;
  };
}

const ROLES: Role[] = ["superadmin", "admin", "manager", "host"];

function fmtDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function AdminPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<Role>("admin");

  const roleBadge: Record<Role, string> = useMemo(() => ({
    superadmin: "bg-purple-100 text-purple-700",
    admin: "bg-blue-100 text-blue-700",
    manager: "bg-emerald-100 text-emerald-700",
    host: "bg-gray-100 text-gray-700",
  }), []);

  const load = useCallback(async () => {
    setLoading(true);
    const [overviewRes, usersRes] = await Promise.all([
      fetch("/api/admin/overview"),
      fetch("/api/admin/users"),
    ]);

    if (overviewRes.status === 403 || usersRes.status === 403) {
      setMessage("Master admin access required for this page.");
      setOverview(null);
      setUsers([]);
      setLoading(false);
      return;
    }

    const [overviewData, usersData] = await Promise.all([
      overviewRes.json(),
      usersRes.json(),
    ]);
    setOverview(overviewData);
    setUsers(Array.isArray(usersData) ? usersData : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch(() => {
      setMessage("Failed to load admin data.");
      setLoading(false);
    });
  }, [load]);

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
      setNewRole("admin");
      setMessage(`Created user ${data.email}.`);
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function updateUser(user: AdminUser, patch: Partial<{ role: Role; isActive: boolean; password: string }>) {
    setMessage("");
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Failed to update user.");
      return;
    }
    setMessage(`Updated ${data.email}.`);
    await load();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-gray-500">
        <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
        Loading admin console...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Backend Admin</h1>
        <p className="text-sm text-gray-500">Master account controls and system overview.</p>
      </div>

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
            <h2 className="font-semibold mb-2">Restaurant Profile (Current Database)</h2>
            <div className="text-sm text-gray-700">{overview.restaurant.name}</div>
            <div className="text-sm text-gray-500">{overview.restaurant.phone || "No phone"} · {overview.restaurant.timezone}</div>
            <div className="text-sm text-gray-500">{overview.restaurant.address || "No address configured"}</div>
            <div className="text-sm text-gray-500">Hours: {overview.restaurant.openTime} - {overview.restaurant.closeTime}</div>
          </div>
        </>
      )}

      <div className="bg-white rounded-xl border p-4">
        <h2 className="font-semibold mb-3">Create User</h2>
        <form onSubmit={createUser} className="grid md:grid-cols-4 gap-3">
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full name" className="h-11 border rounded px-3 text-sm" required />
          <input value={newEmail} onChange={e => setNewEmail(e.target.value)} type="email" placeholder="email@restaurant.com" className="h-11 border rounded px-3 text-sm" required />
          <input value={newPassword} onChange={e => setNewPassword(e.target.value)} type="password" placeholder="Password (min 8)" className="h-11 border rounded px-3 text-sm" required />
          <select value={newRole} onChange={e => setNewRole(e.target.value as Role)} className="h-11 border rounded px-3 text-sm">
            {ROLES.map(role => <option key={role} value={role}>{role}</option>)}
          </select>
          <button disabled={creating} className="md:col-span-4 h-11 rounded bg-blue-600 text-white text-sm font-medium transition-all duration-200 disabled:opacity-60">
            {creating ? "Creating..." : "Create User"}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border p-4">
        <h2 className="font-semibold mb-3">Users</h2>
        <div className="space-y-3">
          {users.map(user => (
            <div key={user.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{user.name}</div>
                  <div className="text-xs text-gray-500">{user.email}</div>
                  <div className="text-xs text-gray-400">Created {fmtDate(user.createdAt)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full ${roleBadge[user.role]}`}>{user.role}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${user.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                    {user.isActive ? "active" : "inactive"}
                  </span>
                </div>
              </div>
              <div className="mt-3 grid sm:grid-cols-3 gap-2">
                <select
                  value={user.role}
                  onChange={e => updateUser(user, { role: e.target.value as Role })}
                  className="h-10 border rounded px-3 text-sm"
                >
                  {ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                </select>
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
            </div>
          ))}
          {users.length === 0 && <div className="text-sm text-gray-500">No users found.</div>}
        </div>
      </div>
    </div>
  );
}
