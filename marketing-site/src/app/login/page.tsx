"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Login failed");

      router.push("/portal");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16 sm:px-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Customer Portal Login</h1>
        <p className="mt-1 text-sm text-slate-600">Access your license, instance, and support tools.</p>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Password</span>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" />
          </label>

          {error ? <p className="text-sm text-rose-700">{error}</p> : null}

          <button type="submit" disabled={loading} className="h-11 w-full rounded-lg bg-slate-900 text-sm font-semibold text-white transition-all duration-200 hover:bg-slate-700 disabled:opacity-60">
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="mt-4 text-right text-sm">
          <Link href="/demo" className="text-blue-700 underline">Forgot password?</Link>
        </div>
      </div>
    </div>
  );
}
