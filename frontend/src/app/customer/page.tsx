"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, clearAuth, getUser } from "@/lib/api";

type Tx = {
  id: number;
  date: string;
  quantityBought: number;
  costPrice?: number;
  costManPrice?: number;
  salePrice?: number;
  manPrice?: number;
  totalAmount: number;
  paymentCash: number;
  paymentBank: number;
  paymentEasypaisa: number;
  paymentTiming?: "morning" | "evening";
  totalPaid?: number;
  remainingBalance: number;
  overpaidAmount?: number;
};

export default function CustomerPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [monthFilter, setMonthFilter] = useState("");
  const [summary, setSummary] = useState<{
    pendingPayments: number;
    previousBalance: number;
    netReceivable: number;
    advanceAmount?: number;
    totalTransactions: number;
    totalPurchasedAmount: number;
  } | null>(null);
  const [customer, setCustomer] = useState<{ name: string; email: string; phone?: string } | null>(null);
  const filteredTransactions = transactions.filter((tx) => {
    if (!monthFilter) return true;
    const txDate = new Date(tx.date);
    if (Number.isNaN(txDate.getTime())) return false;
    const txMonth = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, "0")}`;
    return txMonth === monthFilter;
  });

  useEffect(() => {
    const user = getUser();
    if (!user || user.role !== "customer") {
      router.push("/");
      return;
    }

    apiFetch("/api/customer/portal-data")
      .then((data) => {
        setCustomer(data.customer);
        setTransactions(data.transactions);
        setSummary(data.summary);
      })
      .catch(() => router.push("/"));
  }, [router]);

  return (
    <main className="min-h-screen bg-linear-to-br from-emerald-50/40 via-zinc-50 to-white p-4 md:p-6 space-y-6">
      <header className="flex flex-col gap-3 rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Customer Portal</h1>
          <p className="text-sm text-zinc-600">Aap apni purchases, payments aur balance yahan dekh sakte hain.</p>
          <p className="mt-1 text-xs text-zinc-500">
            Logged in as: <span className="font-semibold">{customer?.name || "-"}</span> ({customer?.email || "-"})
          </p>
        </div>
        <button onClick={() => { clearAuth(); router.push('/'); }} className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-all duration-300 hover:-translate-y-1 hover:bg-zinc-700">Logout</button>
      </header>

      <section className="grid md:grid-cols-5 gap-4">
        <div className="rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-zinc-500">Pending Balance / Baqi Raqam</p>
            <span className="rounded-lg bg-amber-100 p-2 text-amber-700"><ClockIcon /></span>
          </div>
          <p className="text-3xl font-bold text-zinc-900">Rs. {summary?.pendingPayments || 0}</p>
        </div>
        <div className="rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-zinc-500">Previous Balance / Purana</p>
            <span className="rounded-lg bg-orange-100 p-2 text-orange-700"><ClockIcon /></span>
          </div>
          <p className="text-3xl font-bold text-zinc-900">Rs. {summary?.previousBalance || 0}</p>
        </div>
        <div className="rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-zinc-500">Total Transactions</p>
            <span className="rounded-lg bg-emerald-100 p-2 text-emerald-700"><ListIcon /></span>
          </div>
          <p className="text-3xl font-bold text-zinc-900">{summary?.totalTransactions || 0}</p>
        </div>
        <div className="rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-zinc-500">Extra Payment / Advance</p>
            <span className="rounded-lg bg-amber-100 p-2 text-amber-700"><WalletIcon /></span>
          </div>
          <p className="text-3xl font-bold text-zinc-900">Rs. {summary?.advanceAmount || 0}</p>
        </div>
        <div className="rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-zinc-500">Net Receivable / Total Lena</p>
            <span className="rounded-lg bg-blue-100 p-2 text-blue-700"><WalletIcon /></span>
          </div>
          <p className="text-3xl font-bold text-zinc-900">Rs. {summary?.netReceivable || 0}</p>
        </div>
      </section>
      {!summary && (
        <section className="grid md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-slate-100 bg-white/85 p-4 shadow-sm backdrop-blur-sm">
              <div className="h-3 w-28 rounded bg-zinc-200" />
              <div className="mt-3 h-8 w-20 rounded bg-zinc-200" />
            </div>
          ))}
        </section>
      )}

      <section className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm overflow-auto">
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <h2 className="font-semibold">Transaction History / Khareedari Record</h2>
          <div className="flex gap-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Month Filter</label>
              <input
                type="month"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition-all duration-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => setMonthFilter("")}
              className="rounded-xl border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition-all duration-300 hover:-translate-y-1 hover:bg-zinc-50"
            >
              Clear
            </button>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-zinc-200">
              <th className="py-3 px-3">Date</th>
              <th className="py-3 px-3">Cost/Man</th>

              <th className="py-3 px-3">Rate/Man</th>
              <th className="py-3 px-3">Maal Quantity</th>
              <th className="py-3 px-3">Maal Amount</th>
              <th className="py-3 px-3">Cash</th>
              <th className="py-3 px-3">Bank</th>
              <th className="py-3 px-3">Easypaisa</th>
              <th className="py-3 px-3">Payment Time</th>
              <th className="py-3 px-3">Total Paid</th>
              <th className="py-3 px-3">Balance</th>
              <th className="py-3 px-3">Overpaid</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map((tx) => (
              <tr key={tx.id} className="border-b border-zinc-100 transition-all duration-300 hover:bg-emerald-50/40">
                <td className="py-3 px-3">{new Date(tx.date).toLocaleDateString()}</td>
                <td className="py-3 px-3">Rs. {tx.costManPrice ?? "-"}</td>
                <td className="py-3 px-3">Rs. {tx.manPrice ?? "-"}</td>
                <td className="py-3 px-3">{tx.quantityBought}</td>
                <td className="py-3 px-3">{tx.totalAmount}</td>
                <td className="py-3 px-3">{tx.paymentCash}</td>
                <td className="py-3 px-3">{tx.paymentBank}</td>
                <td className="py-3 px-3">{tx.paymentEasypaisa}</td>
                <td className="py-3 px-3">{tx.paymentTiming === "evening" ? "Evening" : "Morning"}</td>
                <td className="py-3 px-3">{tx.totalPaid ?? (tx.paymentCash + tx.paymentBank + tx.paymentEasypaisa)}</td>
                <td className="py-3 px-3">{tx.remainingBalance}</td>
                <td className={`py-3 px-3 ${tx.overpaidAmount ? "font-semibold text-amber-700" : ""}`}>
                  {tx.overpaidAmount ? `Rs. ${tx.overpaidAmount}` : "-"}
                </td>
              </tr>
            ))}
            {!filteredTransactions.length && (
              <tr>
                <td colSpan={12} className="py-10 text-center text-sm text-zinc-500">
                  Is month ke liye koi record nahi mila.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function ClockIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
}
function ListIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6h12"/><path d="M8 12h12"/><path d="M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>;
}
function WalletIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M16 12h.01"/></svg>;
}
