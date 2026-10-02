"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, clearAuth, getUser } from "@/lib/api";

type Customer = {
  id: number;
  name: string;
  phone?: string;
  openingBalance?: number;
  balance: number;
  advanceAmount?: number;
};

type Tx = {
  id: number;
  date: string;
  customerId: number;
  quantityBought: number;
  manPrice?: number;
  totalAmount: number;
  totalPaid: number;
  remainingBalance: number;
  overpaidAmount?: number;
  profit?: number;
};

export default function AdminCustomerDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const customerId = Number(params?.id || 0);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [monthFilter, setMonthFilter] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const user = getUser();
    if (!user || user.role !== "admin") {
      router.push("/");
      return;
    }

    Promise.all([apiFetch("/api/customers"), apiFetch("/api/transactions")])
      .then(([customers, txs]) => {
        const matched = (customers as Customer[]).find((c) => c.id === customerId) || null;
        if (!matched) {
          setError("Customer not found");
          return;
        }
        setCustomer(matched);
        setTransactions((txs as Tx[]).filter((t) => t.customerId === customerId));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load customer record"));
  }, [customerId, router]);

  const filteredTransactions = useMemo(() => {
    return [...transactions]
      .filter((tx) => {
        if (!monthFilter) return true;
        const txDate = new Date(tx.date);
        if (Number.isNaN(txDate.getTime())) return false;
        const txMonth = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, "0")}`;
        return txMonth === monthFilter;
      })
      .reverse();
  }, [monthFilter, transactions]);

  const totals = useMemo(() => {
    return {
      sales: filteredTransactions.reduce((sum, t) => sum + Number(t.totalAmount || 0), 0),
      paid: filteredTransactions.reduce((sum, t) => sum + Number(t.totalPaid || 0), 0),
      profit: filteredTransactions.reduce((sum, t) => sum + Number(t.profit || 0), 0),
    };
  }, [filteredTransactions]);

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8 space-y-6">
      <header className="flex flex-col gap-3 rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Customer Record: {customer?.name || `#${customerId}`}
          </h1>
          <p className="text-sm text-zinc-500">Admin yahan customer ka portal jaisa record dekh sakta hai (without re-login).</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push("/admin")}
            className="rounded-xl border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50"
          >
            Back to Admin
          </button>
          <button
            onClick={() => {
              clearAuth();
              router.push("/");
            }}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
          >
            Logout
          </button>
        </div>
      </header>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</p>}

      {customer && (
        <>
          <section className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm text-zinc-700 shadow-sm">
            <p className="font-medium">Easy Formula:</p>
            <p className="mt-1">
              <span className="font-medium">Current Due</span> = Previous Balance + Total Sales - Total Paid
            </p>
            <p className="mt-1">
              Agar paid zyada ho jaye to wo <span className="font-medium">Advance</span> me show hota hai.
            </p>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card
              title="Previous Balance / Purana"
              helper="Register se pehle ki baqi raqam"
              value={Number(customer.openingBalance || 0)}
            />
            <Card
              title="Current Due / Is Waqt Lena"
              helper="Abhi customer se kitna lena hai"
              value={Number(customer.balance || 0)}
            />
            <Card
              title="Advance / Ziada Jama"
              helper="Customer ne jitna extra de diya"
              value={Number(customer.advanceAmount || 0)}
            />
            <Card
              title="Sales (Selected Month)"
              helper="Filter month ka total maal amount"
              value={totals.sales}
            />
            <Card
              title="Paid (Selected Month)"
              helper="Filter month me total wasooli"
              value={totals.paid}
            />
          </section>
        </>
      )}

      <section className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="font-semibold">Transaction History / Khareedari Record</h2>
          <div className="flex gap-2">
            <input
              type="month"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setMonthFilter("")}
              className="rounded-xl border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="max-h-[480px] overflow-auto rounded-xl border border-zinc-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-zinc-50">
              <tr className="border-b border-zinc-200 text-left">
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Maal Qty</th>
                <th className="py-3 px-3">Rate/Man</th>
                <th className="py-3 px-3">Maal Amount</th>
                <th className="py-3 px-3">Paid</th>
                <th className="py-3 px-3">Balance</th>
                <th className="py-3 px-3">Overpaid</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((tx) => (
                <tr key={tx.id} className="border-b border-zinc-100 hover:bg-slate-50">
                  <td className="py-3 px-3">{new Date(tx.date).toLocaleDateString()}</td>
                  <td className="py-3 px-3">{tx.quantityBought}</td>
                  <td className="py-3 px-3">Rs. {tx.manPrice ?? "-"}</td>
                  <td className="py-3 px-3">Rs. {Number(tx.totalAmount || 0).toLocaleString()}</td>
                  <td className="py-3 px-3">Rs. {Number(tx.totalPaid || 0).toLocaleString()}</td>
                  <td className="py-3 px-3">Rs. {Number(tx.remainingBalance || 0).toLocaleString()}</td>
                  <td className={`py-3 px-3 ${tx.overpaidAmount ? "font-semibold text-amber-700" : ""}`}>
                    {tx.overpaidAmount ? `Rs. ${Number(tx.overpaidAmount).toLocaleString()}` : "-"}
                  </td>
                </tr>
              ))}
              {!filteredTransactions.length && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-zinc-500">
                    Is filter ke liye koi record nahi mila.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Card({ title, helper, value }: { title: string; helper: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</p>
      <p className="mt-1 text-[11px] text-slate-400">{helper}</p>
      <p className="mt-2 text-3xl font-extrabold text-zinc-900">Rs. {Number(value || 0).toLocaleString()}</p>
    </div>
  );
}
