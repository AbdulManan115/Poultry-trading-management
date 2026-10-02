"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, clearAuth, getUser } from "@/lib/api";

type Summary = {
  totalSales: number;
  receivedPayments: number;
  pendingPayments: number;
  previousBalance: number;
  netReceivable: number;
  totalAdvance?: number;
  totalProfit: number;
  inventory: { id: number; product: string; quantity: number; costPrice: number }[];
};

type Customer = { id: number; name: string; phone: string; openingBalance?: number; balance: number; advanceAmount?: number };
type Transaction = {
  id: number;
  date: string;
  customerId: number;
  quantityBought: number;
  costPrice?: number;
  costManPrice?: number;
  salePrice?: number;
  manPrice?: number;
  paymentCash?: number;
  paymentBank?: number;
  paymentEasypaisa?: number;
  paymentTiming?: "morning" | "evening";
  totalAmount: number;
  totalPaid: number;
  remainingBalance: number;
  overpaidAmount?: number;
  profit?: number;
};

export default function AdminPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customerFilterId, setCustomerFilterId] = useState("all");
  const [monthFilter, setMonthFilter] = useState("");
  const [editingTxId, setEditingTxId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [customerOpeningInput, setCustomerOpeningInput] = useState("0");

  const [customerForm, setCustomerForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [txForm, setTxForm] = useState({ customerId: "1", quantityBought: "10", costPrice: "", costManPrice: "16200", salePrice: "", manPrice: "16400", paymentCash: "1000", paymentBank: "0", paymentEasypaisa: "0", paymentTiming: "morning" });
  const selectedCustomer = customers.find((c) => String(c.id) === txForm.customerId);
  const summaryCustomer = customers.find((c) => String(c.id) === customerFilterId);
  const summaryTransactions =
    customerFilterId === "all"
      ? transactions
      : transactions.filter((tx) => String(tx.customerId) === customerFilterId);
  const computedSummary =
    customerFilterId === "all" || !summaryCustomer
      ? summary
      : {
          totalSales: summaryTransactions.reduce((sum, tx) => sum + Number(tx.totalAmount || 0), 0),
          receivedPayments: summaryTransactions.reduce((sum, tx) => sum + Number(tx.totalPaid || 0), 0),
          pendingPayments: Number(summaryCustomer.balance || 0),
          previousBalance: Number(summaryCustomer.openingBalance || 0),
          netReceivable: Number(summaryCustomer.balance || 0),
          totalAdvance: Number(summaryCustomer.advanceAmount || 0),
          totalProfit: summaryTransactions.reduce((sum, tx) => sum + Number(tx.profit || 0), 0),
          inventory: summary?.inventory || [],
        };
  const filteredTransactions = [...transactions]
    .reverse()
    .filter((tx) => {
      if (customerFilterId !== "all" && String(tx.customerId) !== customerFilterId) return false;
      if (!monthFilter) return true;
      const txDate = new Date(tx.date);
      if (Number.isNaN(txDate.getTime())) return false;
      const txMonth = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, "0")}`;
      return txMonth === monthFilter;
    });
  const effectiveCostPrice =
    Number(txForm.costPrice || 0) || (Number(txForm.costManPrice || 0) ? Number(txForm.costManPrice || 0) / 40 : 0);
  const effectiveSalePrice =
    Number(txForm.salePrice || 0) || (Number(txForm.manPrice || 0) ? Number(txForm.manPrice || 0) / 40 : 0);
  const previewTotal = Number(txForm.quantityBought || 0) * effectiveSalePrice;
  const previewPaid =
    Number(txForm.paymentCash || 0) + Number(txForm.paymentBank || 0) + Number(txForm.paymentEasypaisa || 0);
  const previewBalance = Math.max(previewTotal - previewPaid, 0);
  const previewOverpaid = Math.max(previewPaid - previewTotal, 0);
  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition-all duration-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";
  const labelClass = "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500";

  async function loadData(opts?: { scopeCustomerId?: string; formCustomerId?: string }) {
    const scopeSnapshot = opts?.scopeCustomerId ?? customerFilterId;
    const formSnapshot = opts?.formCustomerId ?? txForm.customerId;
    try {
      const [s, c, t] = await Promise.all([
        apiFetch("/api/dashboard/summary"),
        apiFetch("/api/customers"),
        apiFetch("/api/transactions"),
      ]);
      setSummary(s);
      setCustomers(c);
      setTransactions(t);
      const openingSource =
        scopeSnapshot === "all"
          ? c.find((customer: Customer) => String(customer.id) === formSnapshot) || c[0]
          : c.find((customer: Customer) => String(customer.id) === scopeSnapshot) || c[0];
      if (openingSource) {
        setCustomerOpeningInput(String(Number(openingSource.openingBalance || 0)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }

  useEffect(() => {
    const user = getUser();
    if (!user || user.role !== "admin") {
      router.push("/");
      return;
    }
    Promise.all([apiFetch("/api/dashboard/summary"), apiFetch("/api/customers"), apiFetch("/api/transactions")])
      .then(([s, c, t]) => {
        setSummary(s);
        setCustomers(c);
        setTransactions(t);
        if (c.length) {
          const firstId = String(c[0].id);
          setCustomerFilterId(firstId);
          setTxForm((prev) => ({ ...prev, customerId: firstId }));
          setCustomerOpeningInput(String(Number(c[0].openingBalance || 0)));
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [router]);

  async function addCustomer(e: React.FormEvent) {
    e.preventDefault();
    await apiFetch("/api/customers", { method: "POST", body: JSON.stringify(customerForm) });
    setCustomerForm({ name: "", email: "", password: "", phone: "" });
    loadData();
  }

  async function deleteCustomer(customer: Customer) {
    const ok = window.confirm(
      `${customer.name} ko delete karna hai?\n\nIs customer ka account aur uski tamam transactions bhi delete ho jayengi.`
    );
    if (!ok) return;

    try {
      await apiFetch(`/api/customers/${customer.id}`, { method: "DELETE" });
      if (String(customer.id) === txForm.customerId) {
        const remaining = customers.filter((c) => c.id !== customer.id);
        const nextId = remaining[0] ? String(remaining[0].id) : "1";
        setTxForm((prev) => ({ ...prev, customerId: nextId }));
        setCustomerFilterId(nextId);
        setCustomerOpeningInput(String(Number(remaining[0]?.openingBalance || 0)));
      }
      loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Customer delete failed";
      setError(message);
      window.alert(`Delete failed: ${message}`);
    }
  }

  async function editCustomer(customer: Customer) {
    const nextName = window.prompt("Customer name update karein:", customer.name)?.trim();
    if (!nextName) return;
    const nextPhone = window.prompt("Phone number update karein:", customer.phone || "")?.trim() ?? "";

    try {
      await apiFetch(`/api/customers/${customer.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: nextName, phone: nextPhone }),
      });
      loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Customer update failed";
      setError(message);
      window.alert(`Update failed: ${message}`);
    }
  }

  async function editCustomerOpeningBalance(customer: Customer) {
    const openingInput = window.prompt(
      "Previous / Opening balance update karein:",
      String(Number(customer.openingBalance || 0))
    );
    if (openingInput === null) return;
    const nextOpeningBalance = Number(openingInput);
    if (Number.isNaN(nextOpeningBalance) || nextOpeningBalance < 0) {
      window.alert("Opening balance valid number honi chahiye (0 ya us se zyada).");
      return;
    }

    try {
      await apiFetch(`/api/customers/${customer.id}/opening-balance`, {
        method: "PUT",
        body: JSON.stringify({ openingBalance: nextOpeningBalance }),
      });
      loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Opening balance update failed";
      setError(message);
      window.alert(`Update failed: ${message}`);
    }
  }

  async function addTransaction(e: React.FormEvent) {
    e.preventDefault();
    const savedCustomerId = txForm.customerId;
    if (editingTxId) {
      await apiFetch(`/api/transactions/${editingTxId}`, { method: "PUT", body: JSON.stringify(txForm) });
      setEditingTxId(null);
    } else {
      await apiFetch("/api/transactions", { method: "POST", body: JSON.stringify(txForm) });
    }
    const nextCustomerId =
      customers.some((c) => String(c.id) === savedCustomerId) ? savedCustomerId : customers[0]
        ? String(customers[0].id)
        : "1";
    setCustomerFilterId(nextCustomerId);
    setTxForm({
      customerId: nextCustomerId,
      quantityBought: "10",
      costPrice: "",
      costManPrice: "16200",
      salePrice: "",
      manPrice: "16400",
      paymentCash: "1000",
      paymentBank: "0",
      paymentEasypaisa: "0",
      paymentTiming: "morning",
    });
    await loadData({ scopeCustomerId: nextCustomerId, formCustomerId: nextCustomerId });
  }

  function startEditTransaction(tx: Transaction) {
    setEditingTxId(tx.id);
    setCustomerFilterId(String(tx.customerId));
    setTxForm({
      customerId: String(tx.customerId),
      quantityBought: String(tx.quantityBought ?? 0),
      costPrice: "",
      costManPrice: String(tx.costManPrice ?? ((tx.costPrice ?? 0) * 40)),
      salePrice: "",
      manPrice: String(tx.manPrice ?? ((tx.salePrice ?? 0) * 40)),
      paymentCash: String(tx.paymentCash ?? 0),
      paymentBank: String(tx.paymentBank ?? 0),
      paymentEasypaisa: String(tx.paymentEasypaisa ?? 0),
      paymentTiming: tx.paymentTiming === "evening" ? "evening" : "morning",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingTxId(null);
    const nextId = customers[0] ? String(customers[0].id) : "1";
    setCustomerFilterId(nextId);
    setTxForm({
      customerId: nextId,
      quantityBought: "10",
      costPrice: "",
      costManPrice: "16200",
      salePrice: "",
      manPrice: "16400",
      paymentCash: "1000",
      paymentBank: "0",
      paymentEasypaisa: "0",
      paymentTiming: "morning",
    });
  }

  async function deleteTransaction(id: number) {
    const ok = window.confirm("Is transaction ko delete karna hai? Ye action wapas nahi hoga.");
    if (!ok) return;

    try {
      await apiFetch(`/api/transactions/${id}`, { method: "DELETE" });
      loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed";
      setError(message);
      window.alert(`Delete failed: ${message}`);
    }
  }

  async function updateCustomerOpeningBalance() {
    if (!selectedCustomer) return;
    try {
      await apiFetch(`/api/customers/${selectedCustomer.id}/opening-balance`, {
        method: "PUT",
        body: JSON.stringify({ openingBalance: Number(customerOpeningInput || 0) }),
      });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update customer previous balance");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8 space-y-8">
      <header className="flex items-center justify-end gap-2 rounded-2xl border border-slate-200/60 bg-white p-3 shadow-sm">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition-all duration-300 hover:bg-zinc-100"
        >
          <span>Admin Dashboard</span>
          <svg className="h-3.5 w-3.5 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        <button
          onClick={() => {
            clearAuth();
            router.push("/");
          }}
          className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-all duration-300 hover:bg-zinc-700"
        >
          Logout
        </button>
      </header>

      <section className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <p className="text-2xl font-extrabold tracking-tight text-emerald-700">JPMS 🐔</p>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
              Jamshaid Poultry Management System
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Smart Poultry Business &amp; Account Management
            </p>
          </div>
        </div>
      </section>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 shadow-sm">{error}</p>}

      {computedSummary && (
        <section className="space-y-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-500">
                Summary Scope:{" "}
                <span className="font-semibold text-zinc-700">
                  {customerFilterId === "all" ? "All Customers" : summaryCustomer?.name || "Selected Customer"}
                </span>
              </p>
              <p className="mt-1 text-[11px] text-zinc-400">
                Customer change karne ke liye neechay &quot;Add Transaction&quot; form me Customer dropdown use karein (ya Recent Transactions filter).
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <Card title="Total Sales / Kul Farokht" value={computedSummary.totalSales} icon={<SalesIcon />} />
            <Card title="Received / Wasool" value={computedSummary.receivedPayments} icon={<IncomeIcon />} />
            <Card title="Pending / Baqi" value={computedSummary.pendingPayments} icon={<PendingIcon />} />
            <Card title="Previous Balance / Purana" value={computedSummary.previousBalance} icon={<PendingIcon />} />
            <Card title="Advance / Ziada" value={computedSummary.totalAdvance || 0} icon={<IncomeIcon />} />
            <Card title="Profit / Munafa" value={computedSummary.totalProfit} icon={<ProfitIcon />} />
          </div>
        </section>
      )}
      {!summary && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
              <div className="h-3 w-28 rounded bg-zinc-200" />
              <div className="mt-3 h-8 w-24 rounded bg-zinc-200" />
            </div>
          ))}
        </section>
      )}
      <section className="grid md:grid-cols-2 gap-8">
        <form onSubmit={addCustomer} className="space-y-4 rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-zinc-900">Add Customer / Naya Grahak</h2>
          <p className="text-xs text-slate-500">Yahan se customer ka login account banega.</p>
          <input placeholder="Customer Name (e.g. Ali Ahmad)" className={inputClass} value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} required />
          <input placeholder="Customer Email (login ke liye)" type="email" className={inputClass} value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} required />
          <input placeholder="Customer Password" type="password" className={inputClass} value={customerForm.password} onChange={(e) => setCustomerForm({ ...customerForm, password: e.target.value })} required />
          <input placeholder="Phone Number" className={inputClass} value={customerForm.phone} onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} />
          <button className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-1 hover:bg-emerald-500">Create Customer</button>
          <div className="pt-2">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Customer List</h3>
            <div className="max-h-44 space-y-2 overflow-auto rounded-lg border border-zinc-200 p-2">
              {customers.map((customer) => (
                <div key={customer.id} className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-zinc-800">{customer.name}</p>
                    <p className="text-xs text-zinc-500">
                      Opening: Rs. {Number(customer.openingBalance || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-zinc-500">Due: Rs. {Number(customer.balance || 0).toLocaleString()}</p>
                    {!!customer.advanceAmount && (
                      <p className="text-xs font-medium text-amber-700">
                        Advance: Rs. {Number(customer.advanceAmount || 0).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => router.push(`/admin/customer/${customer.id}`)}
                      className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 transition-all duration-300 hover:-translate-y-1 hover:bg-violet-100"
                    >
                      View Record
                    </button>
                    <button
                      type="button"
                      onClick={() => editCustomerOpeningBalance(customer)}
                      className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 transition-all duration-300 hover:-translate-y-1 hover:bg-blue-100"
                    >
                      Edit Opening
                    </button>
                    <button
                      type="button"
                      onClick={() => editCustomer(customer)}
                      className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 transition-all duration-300 hover:-translate-y-1 hover:bg-emerald-100"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCustomer(customer)}
                      className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-600 transition-all duration-300 hover:-translate-y-1 hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {!customers.length && <p className="py-3 text-center text-xs text-zinc-500">No customer yet.</p>}
            </div>
          </div>
        </form>

        <form onSubmit={addTransaction} className="space-y-4 rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
          <h2 className="font-semibold">
            {editingTxId ? `Edit Transaction #${editingTxId}` : "Add Transaction / Nayi Sale Entry"}
          </h2>
          <p className="text-xs text-slate-500">Quantity, rate aur payment split dalen. Balance auto-calculate hoga.</p>
          <div>
            <label className={labelClass}>Customer / Grahak</label>
            <div className="relative">
              <select
                className={`${inputClass} appearance-none pr-10`}
                value={txForm.customerId}
                onChange={(e) => {
                  const nextCustomerId = e.target.value;
                  const nextCustomer = customers.find((c) => String(c.id) === nextCustomerId);
                  setCustomerFilterId(nextCustomerId);
                  setTxForm({ ...txForm, customerId: nextCustomerId });
                  setCustomerOpeningInput(String(Number(nextCustomer?.openingBalance || 0)));
                }}
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} - Current Due: Rs. {Number(c.balance || 0).toLocaleString()}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Current Due ka matlab: is customer ki pehle se baqi raqam.
            </p>
          </div>

          <div>
            <label className={labelClass}>Quantity (Murghi Count)</label>
            <input placeholder="e.g. 10" className={inputClass} value={txForm.quantityBought} onChange={(e) => setTxForm({ ...txForm, quantityBought: e.target.value })} />
          </div>

          <div>
            <label className={labelClass}>Cost Price per Man (Khareed Rate - 1 Man = 40 Kg)</label>
            <input
              placeholder="e.g. 16200"
              className={inputClass}
              value={txForm.costManPrice}
              onChange={(e) => setTxForm({ ...txForm, costManPrice: e.target.value, costPrice: "" })}
            />
            <p className="mt-1 text-xs text-zinc-500">
              Ye aapki khareed price hai. System isay khud per-kg me convert karega.
            </p>
          </div>
          <div>
            <label className={labelClass}>Sale Price per Man (Customer ko dena - 1 Man = 40 Kg)</label>
            <input
              placeholder="e.g. 16200"
              className={inputClass}
              value={txForm.manPrice}
              onChange={(e) => setTxForm({ ...txForm, manPrice: e.target.value, salePrice: "" })}
            />
            <p className="mt-1 text-xs text-zinc-500">System khud per-kg rate nikalega: man/40.</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={labelClass}>Cash</label>
              <input placeholder="0" className={inputClass} value={txForm.paymentCash} onChange={(e) => setTxForm({ ...txForm, paymentCash: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Bank</label>
              <input placeholder="0" className={inputClass} value={txForm.paymentBank} onChange={(e) => setTxForm({ ...txForm, paymentBank: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Easypaisa</label>
              <input placeholder="0" className={inputClass} value={txForm.paymentEasypaisa} onChange={(e) => setTxForm({ ...txForm, paymentEasypaisa: e.target.value })} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Payment Time</label>
            <select
              className={inputClass}
              value={txForm.paymentTiming}
              onChange={(e) => setTxForm({ ...txForm, paymentTiming: e.target.value as "morning" | "evening" })}
            >
              <option value="morning">Morning / Subha</option>
              <option value="evening">Evening / Shaam</option>
            </select>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm">
            <p className="flex items-center gap-2 border-b border-emerald-100 pb-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /><span className="text-zinc-500">Selected Customer:</span> {selectedCustomer?.name || "-"}</p>
            <div className="mt-3 rounded-lg border border-emerald-100 bg-white p-3">
              <p className="text-xs text-zinc-500">Opening Balance is customer-wise (har customer alag).</p>
              <div className="mt-2 flex gap-2">
                <input
                  type="number"
                  min="0"
                  className={inputClass}
                  value={customerOpeningInput}
                  onChange={(e) => setCustomerOpeningInput(e.target.value)}
                />
                <button
                  type="button"
                  onClick={updateCustomerOpeningBalance}
                  className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-all duration-300 hover:-translate-y-1 hover:bg-emerald-500"
                >
                  Save Opening
                </button>
              </div>
              <p className="mt-1 text-xs text-zinc-500">Current Due (with opening): Rs. {Number(selectedCustomer?.balance || 0).toLocaleString()}</p>
              {!!selectedCustomer?.advanceAmount && (
                <p className="mt-1 text-xs font-medium text-amber-700">
                  Extra Payment / Advance: Rs. {Number(selectedCustomer?.advanceAmount || 0).toLocaleString()}
                </p>
              )}
            </div>
            <p className="mt-2 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /><span className="text-zinc-500">Cost Rate (Per Kg):</span> Rs. {effectiveCostPrice.toLocaleString()}</p>
            <p className="mt-1 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /><span className="text-zinc-500">Effective Rate (Per Kg):</span> Rs. {effectiveSalePrice.toLocaleString()}</p>
            <p className="mt-1 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /><span className="text-zinc-500">Estimated Profit (Per Kg):</span> Rs. {(effectiveSalePrice - effectiveCostPrice).toLocaleString()}</p>
            <p className="mt-1 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /><span className="text-zinc-500">This Sale Total:</span> Rs. {previewTotal.toLocaleString()}</p>
            <p className="mt-1 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /><span className="text-zinc-500">This Sale Paid:</span> Rs. {previewPaid.toLocaleString()}</p>
            <p className="mt-1 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /><span className="text-zinc-500">This Sale Remaining:</span> Rs. {previewBalance.toLocaleString()}</p>
            {previewOverpaid > 0 && (
              <p className="mt-2 font-semibold text-amber-700">
                Extra Payment / Advance: Rs. {previewOverpaid.toLocaleString()}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-1 hover:bg-emerald-500">
              {editingTxId ? "Update Transaction" : "Save Transaction"}
            </button>
            {editingTxId && (
              <button type="button" onClick={cancelEdit} className="rounded-xl border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition-all duration-300 hover:-translate-y-1 hover:bg-zinc-50">
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <h2 className="font-semibold">Recent Transactions / Aakhri Entries</h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div>
              <label className={labelClass}>Customer Filter</label>
              <select
                className={inputClass}
                value={customerFilterId}
                onChange={(e) => {
                  const v = e.target.value;
                  setCustomerFilterId(v);
                  if (v !== "all") {
                    const nextCustomer = customers.find((c) => String(c.id) === v);
                    setTxForm((prev) => ({ ...prev, customerId: v }));
                    setCustomerOpeningInput(String(Number(nextCustomer?.openingBalance || 0)));
                  }
                }}
              >
                <option value="all">All Customers</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Month Filter</label>
              <input
                type="month"
                className={inputClass}
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setCustomerFilterId("all");
                setMonthFilter("");
                if (customers[0]) {
                  const firstId = String(customers[0].id);
                  setTxForm((prev) => ({ ...prev, customerId: firstId }));
                  setCustomerOpeningInput(String(Number(customers[0].openingBalance || 0)));
                }
              }}
              className="rounded-xl border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition-all duration-300 hover:-translate-y-1 hover:bg-zinc-50"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="max-h-[420px] overflow-auto rounded-xl border border-zinc-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-zinc-50">
              <tr className="border-b border-zinc-200 text-left">
                <th className="py-4 px-3">Date</th>
                <th className="py-4 px-3">Customer</th>
                <th className="py-4 px-3">Qty</th>
                <th className="py-4 px-3">Total</th>
                <th className="py-4 px-3">Paid</th>
                <th className="py-4 px-3">Balance</th>
                <th className="py-4 px-3">Payment Time</th>
                <th className="py-4 px-3">Overpaid</th>
                <th className="py-4 px-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((tx) => {
                const customer = customers.find((c) => c.id === tx.customerId);
                return (
                  <tr key={tx.id} className="border-b border-zinc-100 transition hover:bg-slate-50">
                    <td className="py-4 px-3">{new Date(tx.date).toLocaleDateString()}</td>
                    <td className="py-4 px-3">{customer?.name || `#${tx.customerId}`}</td>
                    <td className="py-4 px-3">{tx.quantityBought}</td>
                    <td className="py-4 px-3">{tx.totalAmount}</td>
                    <td className="py-4 px-3">{tx.totalPaid}</td>
                    <td className="py-4 px-3">{tx.remainingBalance}</td>
                    <td className="py-4 px-3">{tx.paymentTiming === "evening" ? "Evening" : "Morning"}</td>
                    <td className={`py-4 px-3 ${tx.overpaidAmount ? "text-amber-700 font-semibold" : ""}`}>
                      {tx.overpaidAmount ? `Rs. ${tx.overpaidAmount}` : "-"}
                    </td>
                    <td className="py-4 px-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEditTransaction(tx)}
                          className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 transition-all duration-300 hover:-translate-y-1 hover:bg-emerald-100"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTransaction(tx.id)}
                          className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-600 transition-all duration-300 hover:-translate-y-1 hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filteredTransactions.length && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-sm text-zinc-500">
                    Is filter ke liye koi record nahi mila.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
        <h2 className="font-semibold mb-3">Inventory / Stock</h2>
        <div className="mb-3 flex flex-wrap gap-2 text-xs font-medium">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">Health: Optimal</span>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700">Temperature: Stable</span>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">Feed: Normal</span>
        </div>
        <div className="grid md:grid-cols-3 gap-3 text-sm">
          {summary?.inventory
            .filter((item) => item.product === "Broiler Chicken")
            .map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-200 bg-zinc-50 p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-sm">
              <p className="font-semibold text-zinc-900">{item.product}</p>
              <p className="mt-1 text-zinc-600">Qty: {item.quantity}</p>
              <p className="text-zinc-600">Cost: {item.costPrice}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Card({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  const [enTitle, urTitle] = title.split("/").map((part) => part.trim());
  return (
    <div className="group rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-600">{enTitle}</p>
          {urTitle && <p className="mt-1 text-xs font-medium text-slate-400">{urTitle}</p>}
        </div>
        <span className="rounded-xl bg-emerald-100/80 p-2.5 text-emerald-700 transition-colors duration-300 group-hover:bg-emerald-200">{icon}</span>
      </div>
      <p className="mt-5 text-3xl font-extrabold leading-tight text-zinc-900 lg:text-[2rem]">
        Rs. {Number(value || 0).toLocaleString()}
      </p>
    </div>
  );
}

function SalesIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19h16"/><path d="M7 15l3-3 3 2 4-5"/></svg>;
}
function IncomeIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>;
}
function PendingIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><path d="M12 16h.01"/></svg>;
}
function ProfitIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 19V8"/><path d="M12 19V5"/><path d="M19 19v-9"/></svg>;
}
