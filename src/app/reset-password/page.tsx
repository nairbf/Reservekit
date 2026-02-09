"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordLoadingState />}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordLoadingState() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 px-4 py-10 md:py-16">
      <div className="max-w-lg mx-auto bg-white border border-gray-100 rounded-2xl shadow-lg p-6 md:p-8">
        <h1 className="text-2xl font-bold text-gray-900">Set a new password</h1>
        <p className="text-sm text-gray-600 mt-2">Loading reset form...</p>
      </div>
    </div>
  );
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Missing reset token. Please request a new link.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not reset password.");
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push("/login"), 1200);
    } catch {
      setError("Could not reset password right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 px-4 py-10 md:py-16">
      <div className="max-w-lg mx-auto bg-white border border-gray-100 rounded-2xl shadow-lg p-6 md:p-8">
        <h1 className="text-2xl font-bold text-gray-900">Set a new password</h1>
        <p className="text-sm text-gray-600 mt-2">Create a new password for your ReserveSit staff account.</p>

        {error && <div className="mt-4 rounded-lg bg-red-50 text-red-700 px-3 py-2 text-sm border border-red-100">{error}</div>}
        {success && (
          <div className="mt-4 rounded-lg bg-green-50 text-green-700 px-3 py-2 text-sm border border-green-100">
            Password updated successfully. Redirecting to login...
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            className="w-full h-11 border rounded px-3"
            required
          />
          <label className="block text-sm font-medium text-gray-700 mt-4 mb-1">Confirm password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Re-enter password"
            className="w-full h-11 border rounded px-3"
            required
          />
          <button
            type="submit"
            disabled={loading || success}
            className="w-full h-11 mt-5 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60 transition-all duration-200"
          >
            {loading ? "Updating..." : "Update password"}
          </button>
        </form>

        <div className="mt-6 text-sm">
          <Link href="/login" className="text-blue-700 hover:text-blue-800 underline underline-offset-2">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
