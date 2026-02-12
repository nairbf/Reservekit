"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@reservesit.com");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || "Login failed");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,#1e293b_0%,#020617_55%)]" />
      <div className="relative grid w-full max-w-4xl gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-slate-100 shadow-2xl backdrop-blur">
          <p className="text-xs uppercase tracking-[0.2em] text-sky-300">ReserveSit</p>
          <h1 className="mt-2 text-3xl font-semibold">Platform Control Center</h1>
          <p className="mt-3 text-sm text-slate-300">
            Manage customer restaurants, licenses, and system health from one internal admin portal.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-slate-300">
            <li>• Provision new restaurants with auto ports and license keys</li>
            <li>• Track health checks and license activity in real time</li>
            <li>• Manage team roles: super admin, admin, and support</li>
          </ul>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        >
          <h2 className="text-2xl font-semibold text-slate-900">Admin Login</h2>
          <p className="mt-1 text-sm text-slate-500">Use your platform credentials.</p>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Email</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                className="h-11 w-full rounded-lg border border-slate-300 px-3 outline-none transition-all duration-200 focus:border-sky-500"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Password</span>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                className="h-11 w-full rounded-lg border border-slate-300 px-3 outline-none transition-all duration-200 focus:border-sky-500"
              />
            </label>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-5 h-11 w-full rounded-lg bg-slate-900 text-sm font-semibold text-white transition-all duration-200 hover:bg-slate-700 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
