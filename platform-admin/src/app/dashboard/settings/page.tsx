"use client";

import { useEffect, useState } from "react";
import type { PlatformRole } from "@/generated/prisma/client";
import { useSessionUser } from "@/components/session-provider";
import { useToast } from "@/components/toast-provider";
import { formatDate } from "@/lib/format";

type PlatformUserRow = {
  id: string;
  email: string;
  name: string;
  role: PlatformRole;
  createdAt: string;
  updatedAt: string;
};

export default function SettingsPage() {
  const me = useSessionUser();
  const { showToast } = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const [users, setUsers] = useState<PlatformUserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<PlatformRole>("ADMIN");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);

  async function loadUsers() {
    if (me.role !== "SUPER_ADMIN") return;
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/users", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load users");
      setUsers((await res.json()) as PlatformUserRow[]);
    } catch {
      showToast("Failed to load admin users.", "error");
    } finally {
      setLoadingUsers(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, [me.role]);

  async function changeOwnPassword(e: React.FormEvent) {
    e.preventDefault();
    setChangingPassword(true);

    try {
      const res = await fetch(`/api/users/${me.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to update password");

      setCurrentPassword("");
      setNewPassword("");
      showToast("Password updated.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update password", "error");
    } finally {
      setChangingPassword(false);
    }
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setCreatingUser(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          role: newUserRole,
          password: newUserPassword,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to create user");

      setNewUserName("");
      setNewUserEmail("");
      setNewUserRole("ADMIN");
      setNewUserPassword("");
      showToast("Admin user added.", "success");
      await loadUsers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to create user", "error");
    } finally {
      setCreatingUser(false);
    }
  }

  async function updateUserRole(id: string, role: PlatformRole) {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to update role");
      showToast("Role updated.", "success");
      await loadUsers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update role", "error");
    }
  }

  async function removeUser(id: string) {
    if (!window.confirm("Remove this admin user?")) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to delete user");
      showToast("Admin user deleted.", "success");
      await loadUsers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete user", "error");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-600">Platform account and admin access controls.</p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Change Your Password</h2>
        <p className="mt-1 text-sm text-slate-600">Logged in as {me.email}</p>
        <form onSubmit={changeOwnPassword} className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            type="password"
            placeholder="Current password"
            required
            className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
          />
          <input
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            type="password"
            placeholder="New password"
            required
            className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
          />
          <button
            type="submit"
            disabled={changingPassword}
            className="h-11 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {changingPassword ? "Updating..." : "Update Password"}
          </button>
        </form>
      </section>

      {me.role === "SUPER_ADMIN" ? (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Platform Admin Users</h2>
            <p className="text-sm text-slate-600">Only SUPER_ADMIN accounts can manage users.</p>
          </div>

          <form onSubmit={createUser} className="grid gap-3 md:grid-cols-5">
            <input
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              placeholder="Name"
              required
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
            />
            <input
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              placeholder="Email"
              type="email"
              required
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
            />
            <select
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value as PlatformRole)}
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
            >
              <option value="ADMIN">ADMIN</option>
              <option value="SUPPORT">SUPPORT</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
            </select>
            <input
              value={newUserPassword}
              onChange={(e) => setNewUserPassword(e.target.value)}
              placeholder="Temp password"
              required
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
            />
            <button
              type="submit"
              disabled={creatingUser}
              className="h-10 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {creatingUser ? "Adding..." : "Add User"}
            </button>
          </form>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingUsers ? (
                  <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-500">Loading users...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-500">No users found.</td></tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-900">{user.name}</td>
                      <td className="px-3 py-2 text-slate-700">{user.email}</td>
                      <td className="px-3 py-2">
                        <select
                          value={user.role}
                          onChange={(e) => void updateUserRole(user.id, e.target.value as PlatformRole)}
                          className="h-8 rounded border border-slate-300 px-2 text-xs"
                        >
                          <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                          <option value="ADMIN">ADMIN</option>
                          <option value="SUPPORT">SUPPORT</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 text-slate-700">{formatDate(user.createdAt)}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => void removeUser(user.id)}
                          disabled={user.id === me.id}
                          className="rounded border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-800 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Admin-user management is restricted to SUPER_ADMIN accounts.
        </div>
      )}
    </div>
  );
}
