"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL, saveAuth } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@farm.com");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputClass =
    "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

  function fillDemo(role: "admin" | "customer") {
    if (role === "admin") {
      setEmail("admin@farm.com");
      setPassword("admin123");
    } else {
      setEmail("customer@farm.com");
      setPassword("customer123");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Login failed");

      saveAuth(data.token, data.user);
      if (data.user.role === "admin") router.push("/admin");
      else router.push("/customer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-linear-to-br from-emerald-50/60 via-zinc-50 to-white flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-2xl border border-slate-100 bg-white/90 p-6 shadow-md backdrop-blur-sm space-y-4">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 text-center">
          <p className="text-2xl font-extrabold tracking-tight text-emerald-700">JPMS 🐔</p>
          <p className="mt-1 text-sm font-semibold text-zinc-800">Jamshaid Poultry Management System</p>
          <p className="mt-1 text-xs text-zinc-500">A Product by Manan Malik</p>
        </div>
        <div className="space-y-1 text-center">
          <p className="text-sm font-medium text-zinc-600">Sign in to continue</p>
          <p className="text-xs text-zinc-500">Manage sales, inventory, and customer accounts</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Demo Quick Login</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => fillDemo("admin")} className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-all duration-300 hover:-translate-y-1 hover:bg-zinc-100">Admin</button>
            <button type="button" onClick={() => fillDemo("customer")} className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-all duration-300 hover:-translate-y-1 hover:bg-zinc-100">Customer</button>
          </div>
          <p className="mt-2 text-xs text-zinc-500">Admin: admin123, Customer: customer123</p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} required />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Password</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className={inputClass} required />
        </div>

        {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button disabled={loading} className="w-full rounded-xl bg-emerald-700 py-2.5 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-1 hover:bg-emerald-600 disabled:opacity-60">
          {loading ? "Signing in..." : "Login"}
        </button>
      </form>
    </main>
  );
}
