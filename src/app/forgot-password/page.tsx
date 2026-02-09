"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [debugResetUrl, setDebugResetUrl] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setDebugResetUrl(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setMessage(data.message || "If an account exists for that email, a reset link has been sent.");
      if (data.debugResetUrl) setDebugResetUrl(String(data.debugResetUrl));
    } catch {
      setMessage("Could not process the request right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 px-4 py-10 md:py-16">
      <div className="max-w-lg mx-auto bg-white border border-gray-100 rounded-2xl shadow-lg p-6 md:p-8">
        <h1 className="text-2xl font-bold text-gray-900">Forgot password</h1>
        <p className="text-sm text-gray-600 mt-2">
          Enter your account email and we&apos;ll send you a secure link to reset your password.
        </p>

        <form onSubmit={handleSubmit} className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Account email</label>
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="manager@restaurant.com"
            className="w-full h-11 border rounded px-3"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 mt-4 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60 transition-all duration-200"
          >
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>

        {message && <p className="mt-4 text-sm text-gray-700">{message}</p>}
        {debugResetUrl && (
          <p className="mt-2 text-sm text-blue-700 break-all">
            Dev link: <a href={debugResetUrl} className="underline">{debugResetUrl}</a>
          </p>
        )}

        <div className="mt-6 text-sm">
          <Link href="/login" className="text-blue-700 hover:text-blue-800 underline underline-offset-2">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}

