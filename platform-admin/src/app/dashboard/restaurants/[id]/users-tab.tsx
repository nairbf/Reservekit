// @ts-nocheck
"use client";

import { formatDate } from "@/lib/format";

interface UsersTabProps {
  [key: string]: any;
}

export function UsersTab(props: UsersTabProps) {
  const {
    staffUsers,
    canManage,
    showNewUser,
    setShowNewUser,
    newUser,
    setNewUser,
    createStaffUser,
    busy,
    editUserName,
    setEditUserName,
    editUserEmail,
    setEditUserEmail,
    editUserRole,
    setEditUserRole,
    resetPasswordValue,
    setResetPasswordValue,
    resetStaffPassword,
    saveStaffUser,
    deleteStaffUser,
  } = props;

  return (
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
  );
}
