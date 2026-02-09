"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) router.push("/dashboard");
    else setError("Invalid email or password");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 px-4 py-10 md:py-16">
      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-6">
        <section className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 mb-2">ReserveSit Platform</p>
          <h1 className="text-3xl font-bold text-gray-900">Run service, not spreadsheets.</h1>
          <p className="mt-3 text-gray-600">
            ReserveSit helps your team manage reservations, waitlists, floor plans, deposits, and event ticketing in one place.
          </p>
          <div className="mt-6 space-y-3 text-sm text-gray-700">
            <div className="flex items-start gap-2">
              <span className="text-blue-700 font-bold">•</span>
              <span>Live dashboard for inbox, tonight&apos;s service, guests, and table flow.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-700 font-bold">•</span>
              <span>Automated email + SMS notifications, reminders, and no-show protection.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-700 font-bold">•</span>
              <span>Optional SpotOn status sync, event ticketing, and self-service guest changes.</span>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
              <p className="text-2xl font-bold text-blue-700">24/7</p>
              <p className="text-xs text-blue-900/80">Guest booking access</p>
            </div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
              <p className="text-2xl font-bold text-emerald-700">One</p>
              <p className="text-xs text-emerald-900/80">Dashboard for host team</p>
            </div>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 w-full">
          <div className="text-center mb-6">
            <div className="text-3xl font-bold text-gray-900">ReserveSit</div>
            <div className="text-sm text-gray-500 mt-1">Staff Login</div>
          </div>
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 text-red-700 px-3 py-2 text-sm border border-red-100">
              {error}
            </div>
          )}
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            placeholder="manager@restaurant.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="h-11 w-full border rounded px-3 mb-4"
            required
          />
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="h-11 w-full border rounded px-3"
            required
          />
          <div className="mt-3 flex items-center justify-between text-sm">
            <Link href="/forgot-password" className="text-blue-700 hover:text-blue-800 underline underline-offset-2">
              Forgot password?
            </Link>
            <Link href="/" className="text-gray-500 hover:text-gray-700">
              Back to site
            </Link>
          </div>
          <button type="submit" className="w-full h-11 mt-5 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition-all duration-200">
            Log In
          </button>
        </form>
      </div>
    </div>
  );
}
