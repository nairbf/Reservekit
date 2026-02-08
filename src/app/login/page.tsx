"use client";
import { useState } from "react";
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-gray-100 px-4">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-2xl font-bold">ReserveKit</div>
          <div className="text-sm text-gray-500">Staff Login</div>
        </div>
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 text-red-700 px-3 py-2 text-sm border border-red-100">
            {error}
          </div>
        )}
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="h-11 w-full border rounded px-3 mb-4" required />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="h-11 w-full border rounded px-3 mb-4" required />
        <button type="submit" className="w-full h-11 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition-all duration-200">Log In</button>
      </form>
    </div>
  );
}
