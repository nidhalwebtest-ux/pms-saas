"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MagnifyingGlassIcon,
  UserCircleIcon,
  DocumentTextIcon,
  BanknotesIcon,
  PrinterIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TenantResult {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  periodStart: string | null;
  periodEnd: string | null;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  status: string;
  dueDate: string;
  reservation?: { reservationNumber?: string | null } | null;
}

interface AllocationPreview {
  invoiceId: string;
  invoiceNumber: string;
  balanceDue: number;
  applied: number;
  resultingStatus: "PAID" | "PARTIALLY_PAID";
  remaining: number;
}

interface Props {
  preselectedTenantId?: string;
  preselectedInvoiceId?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function roundOMR(n: number) {
  return Math.round(n * 1000) / 1000;
}

function fmtPeriod(start: string | null, end: string | null) {
  if (!start || !end) return "";
  const s = new Date(start).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const e = new Date(end).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return `${s} – ${e}`;
}

function isOverdue(inv: Invoice): boolean {
  return (
    (inv.status === "PENDING" || inv.status === "PARTIALLY_PAID" || inv.status === "DUE" || inv.status === "ISSUED") &&
    new Date(inv.dueDate) < new Date()
  );
}

function computeAllocations(invoices: Invoice[], amount: number): AllocationPreview[] {
  const result: AllocationPreview[] = [];
  let remaining = roundOMR(amount);

  for (const inv of invoices) {
    if (remaining <= 0) break;
    const due    = roundOMR(Number(inv.balanceDue));
    const apply  = Math.min(due, remaining);
    remaining    = roundOMR(remaining - apply);
    const after  = roundOMR(due - apply);
    result.push({
      invoiceId:       inv.id,
      invoiceNumber:   inv.invoiceNumber,
      balanceDue:      due,
      applied:         apply,
      resultingStatus: after <= 0 ? "PAID" : "PARTIALLY_PAID",
      remaining:       after,
    });
  }

  return result;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SmartPaymentForm({ preselectedTenantId, preselectedInvoiceId }: Props) {
  const router = useRouter();

  // ── State ─────────────────────────────────────────────────────────────────
  const [mode, setMode]                   = useState<"tenant" | "invoice">(preselectedInvoiceId ? "invoice" : "tenant");

  // Tenant search
  const [tenantQuery, setTenantQuery]     = useState("");
  const [tenantResults, setTenantResults] = useState<TenantResult[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<TenantResult | null>(null);
  const [showDropdown, setShowDropdown]   = useState(false);
  const searchTimeout                     = useRef<ReturnType<typeof setTimeout>>();

  // Invoices
  const [invoices, setInvoices]           = useState<Invoice[]>([]);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // Pre-selected invoice (mode A)
  const [preInvoice, setPreInvoice]       = useState<Invoice | null>(null);

  // Payment details
  const [amount, setAmount]               = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "BANK_TRANSFER" | "CHEQUE">("CASH");
  const [reference, setReference]        = useState("");
  const [notes, setNotes]                 = useState("");
  const [paymentDate, setPaymentDate]     = useState(new Date().toISOString().slice(0, 10));

  // Submission
  const [submitting, setSubmitting]       = useState(false);

  // ── Load pre-selected invoice ─────────────────────────────────────────────
  useEffect(() => {
    if (!preselectedInvoiceId) return;
    fetch(`/api/invoices/${preselectedInvoiceId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.invoice) {
          setPreInvoice(data.invoice);
          setAmount(Number(data.invoice.balanceDue).toFixed(3));
        }
      })
      .catch(() => {});
  }, [preselectedInvoiceId]);

  // ── Load pre-selected tenant ──────────────────────────────────────────────
  useEffect(() => {
    if (!preselectedTenantId || mode !== "tenant") return;
    fetch(`/api/tenants/${preselectedTenantId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.tenant) {
          setSelectedTenant({
            id:        data.tenant.id,
            firstName: data.tenant.firstName,
            lastName:  data.tenant.lastName,
            phone:     data.tenant.phone,
          });
        }
      })
      .catch(() => {});
  }, [preselectedTenantId, mode]);

  // ── Load invoices when tenant selected ───────────────────────────────────
  const loadInvoices = useCallback(async (tenantId: string) => {
    setLoadingInvoices(true);
    try {
      const res  = await fetch(`/api/invoices?tenantId=${tenantId}&outstanding=true&limit=50`);
      const data = await res.json();
      const invs: Invoice[] = (data.invoices ?? []).map((i: Record<string, unknown>) => ({
        id:           i.id,
        invoiceNumber: i.invoiceNumber,
        periodStart:  i.periodStart ?? null,
        periodEnd:    i.periodEnd ?? null,
        totalAmount:  Number(i.totalAmount),
        amountPaid:   Number(i.amountPaid),
        balanceDue:   Number(i.balanceDue),
        status:       i.status,
        dueDate:      i.dueDate,
        reservation:  (i as { reservation?: { reservationNumber?: string | null } | null }).reservation,
      }));
      // Sort oldest first
      invs.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      setInvoices(invs);
      // Pre-check all
      setSelectedInvoiceIds(new Set(invs.map((i) => i.id)));
    } catch {
      toast.error("Failed to load invoices");
    } finally {
      setLoadingInvoices(false);
    }
  }, []);

  useEffect(() => {
    if (selectedTenant) loadInvoices(selectedTenant.id);
    else { setInvoices([]); setSelectedInvoiceIds(new Set()); }
  }, [selectedTenant, loadInvoices]);

  // ── Auto-fill amount when invoice selection changes ───────────────────────
  useEffect(() => {
    if (!selectedTenant) return;
    const selected = invoices.filter((i) => selectedInvoiceIds.has(i.id));
    const total    = roundOMR(selected.reduce((s, i) => s + Number(i.balanceDue), 0));
    if (total > 0) setAmount(total.toFixed(3));
  }, [selectedInvoiceIds, invoices, selectedTenant]);

  // ── Tenant search (debounced) ─────────────────────────────────────────────
  function onTenantInput(val: string) {
    setTenantQuery(val);
    clearTimeout(searchTimeout.current);
    if (val.trim().length < 2) { setTenantResults([]); setShowDropdown(false); return; }
    searchTimeout.current = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/tenants?search=${encodeURIComponent(val)}&limit=10`);
        const data = await res.json();
        setTenantResults(data.tenants ?? []);
        setShowDropdown(true);
      } catch { /* ignore */ }
    }, 300);
  }

  function pickTenant(t: TenantResult) {
    setSelectedTenant(t);
    setTenantQuery(`${t.firstName} ${t.lastName}`);
    setShowDropdown(false);
  }

  // ── Allocation preview ────────────────────────────────────────────────────
  const numAmount    = parseFloat(amount) || 0;
  const selectedInvs = invoices.filter((i) => selectedInvoiceIds.has(i.id));
  const allocations  = selectedTenant && numAmount > 0
    ? computeAllocations(selectedInvs, numAmount)
    : [];
  const totalSelected = roundOMR(selectedInvs.reduce((s, i) => s + i.balanceDue, 0));
  const overpayment   = roundOMR(numAmount - totalSelected);

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(printAfter: boolean) {
    if (submitting) return;

    if (mode === "tenant" && !selectedTenant) {
      toast.error("Please select a tenant");
      return;
    }
    if (!amount || numAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if ((paymentMethod === "CARD" || paymentMethod === "BANK_TRANSFER" || paymentMethod === "CHEQUE") && !reference) {
      toast.error("Reference is required for this payment method");
      return;
    }

    // Resolve tenantId
    let effectiveTenantId: string | undefined;
    if (mode === "tenant") {
      effectiveTenantId = selectedTenant!.id;
    } else if (mode === "invoice" && preInvoice) {
      // Fetch tenantId from invoice details (already loaded in preInvoice via API)
      // The invoice API returns tenantId; if not available, we retrieve it here
      try {
        const res  = await fetch(`/api/invoices/${preInvoice.id}`);
        const data = await res.json();
        effectiveTenantId = data.invoice?.tenantId ?? data.tenantId;
      } catch {
        toast.error("Failed to resolve tenant for this invoice");
        return;
      }
    }

    if (!effectiveTenantId) {
      toast.error("Could not resolve tenant. Please try again.");
      return;
    }

    const body: Record<string, unknown> = {
      tenantId:  effectiveTenantId,
      amount:    numAmount,
      method:    paymentMethod,
      reference: reference || undefined,
      notes:     notes || undefined,
      date:      paymentDate,
    };

    if (mode === "invoice" && preInvoice) {
      body.invoiceAllocations = [{ invoiceId: preInvoice.id, amount: numAmount }];
    } else if (allocations.length > 0 && selectedInvoiceIds.size > 0) {
      body.invoiceAllocations = allocations
        .filter((a) => a.applied > 0)
        .map((a) => ({
          invoiceId: a.invoiceId,
          amount:    a.applied,
        }));
    }

    setSubmitting(true);
    try {
      const res  = await fetch("/api/payments", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to record payment");
        return;
      }
      const payId = data.payment?.id ?? data.id;
      toast.success("Payment recorded successfully");
      if (printAfter && payId) {
        window.open(`/api/payments/${payId}/receipt-pdf`, "_blank");
      }
      router.push(payId ? `/dashboard/payments/${payId}` : "/dashboard/payments");
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────
  const needsReference = paymentMethod !== "CASH";

  return (
    <div className="space-y-6">

      {/* ─────────── Mode A: Invoice pre-selected ─────────── */}
      {mode === "invoice" && preInvoice && (
        <div className="bg-white rounded-lg shadow-sm ring-1 ring-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
            <DocumentTextIcon className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Invoice</h2>
          </div>
          <div className="px-4 py-4 flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm font-bold text-gray-900 font-mono">{preInvoice.invoiceNumber}</p>
              <p className="text-xs text-gray-500">{fmtPeriod(preInvoice.periodStart, preInvoice.periodEnd)}</p>
              <p className="text-xs text-gray-500">Total: {preInvoice.totalAmount.toFixed(3)} OMR</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Balance Due</p>
              <p className="text-lg font-bold text-red-600">{preInvoice.balanceDue.toFixed(3)} OMR</p>
            </div>
          </div>
        </div>
      )}

      {/* ─────────── Mode B: Tenant search ─────────── */}
      {mode === "tenant" && (
        <div className="bg-white rounded-lg shadow-sm ring-1 ring-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
            <UserCircleIcon className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Step 1 — Select Tenant</h2>
          </div>
          <div className="px-4 py-4">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={tenantQuery}
                onChange={(e) => onTenantInput(e.target.value)}
                onFocus={() => tenantResults.length > 0 && setShowDropdown(true)}
                placeholder="Search tenant by name or phone…"
                className="block w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {showDropdown && tenantResults.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full bg-white rounded-md shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
                  {tenantResults.map((t) => (
                    <li
                      key={t.id}
                      onClick={() => pickTenant(t)}
                      className="px-4 py-2.5 text-sm cursor-pointer hover:bg-blue-50 flex items-center justify-between"
                    >
                      <span className="font-medium text-gray-900">{t.firstName} {t.lastName}</span>
                      <span className="text-gray-500 text-xs">{t.phone}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {selectedTenant && (
              <div className="mt-3 flex items-center gap-3 p-3 bg-blue-50 rounded-md border border-blue-100">
                <div className="h-8 w-8 rounded-full bg-blue-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-blue-700">
                    {selectedTenant.firstName[0]}{selectedTenant.lastName[0]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{selectedTenant.firstName} {selectedTenant.lastName}</p>
                  <p className="text-xs text-gray-500">{selectedTenant.phone}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedTenant(null); setTenantQuery(""); setInvoices([]); setSelectedInvoiceIds(new Set()); setAmount(""); }}
                  className="text-xs text-gray-400 hover:text-red-600"
                >
                  Change
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────── Invoice selection (Mode B) ─────────── */}
      {mode === "tenant" && selectedTenant && (
        <div className="bg-white rounded-lg shadow-sm ring-1 ring-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DocumentTextIcon className="h-4 w-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-700">Step 2 — Outstanding Invoices</h2>
            </div>
            {invoices.length > 0 && (
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedInvoiceIds.size === invoices.length}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedInvoiceIds(new Set(invoices.map((i) => i.id)));
                    else setSelectedInvoiceIds(new Set());
                  }}
                  className="rounded"
                />
                Select All
              </label>
            )}
          </div>
          {loadingInvoices ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">Loading invoices…</div>
          ) : invoices.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <CheckCircleIcon className="mx-auto h-8 w-8 text-green-400 mb-2" />
              <p className="text-sm text-gray-500">No outstanding invoices for this tenant.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {invoices.map((inv) => {
                const checked  = selectedInvoiceIds.has(inv.id);
                const overdue  = isOverdue(inv);
                return (
                  <li
                    key={inv.id}
                    onClick={() => {
                      const next = new Set(selectedInvoiceIds);
                      if (next.has(inv.id)) next.delete(inv.id);
                      else next.add(inv.id);
                      setSelectedInvoiceIds(next);
                    }}
                    className={`px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors ${checked ? "bg-blue-50" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {}}
                      className="rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-semibold text-gray-900">{inv.invoiceNumber}</span>
                        {overdue && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                            <ExclamationTriangleIcon className="h-3 w-3" /> Overdue
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{fmtPeriod(inv.periodStart, inv.periodEnd)}</p>
                      <p className="text-xs text-gray-400">Due: {new Date(inv.dueDate).toLocaleDateString("en-GB")}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-red-600">{Number(inv.balanceDue).toFixed(3)} OMR</p>
                      <p className="text-xs text-gray-400">of {Number(inv.totalAmount).toFixed(3)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* ─────────── Payment Details ─────────── */}
      {(mode === "invoice" || selectedTenant) && (
        <div className="bg-white rounded-lg shadow-sm ring-1 ring-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
            <BanknotesIcon className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">
              {mode === "invoice" ? "Step 2" : "Step 3"} — Payment Details
            </h2>
          </div>
          <div className="px-4 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Amount */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Amount (OMR) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.000"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Method */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Payment Method <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-3">
                {(["CASH", "CARD", "BANK_TRANSFER", "CHEQUE"] as const).map((m) => (
                  <label
                    key={m}
                    className={`flex items-center gap-2 cursor-pointer rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                      paymentMethod === m
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="method"
                      value={m}
                      checked={paymentMethod === m}
                      onChange={() => setPaymentMethod(m)}
                      className="sr-only"
                    />
                    {m === "CASH" ? "Cash" : m === "CARD" ? "Card" : m === "BANK_TRANSFER" ? "Bank Transfer" : "Cheque"}
                  </label>
                ))}
              </div>
            </div>

            {/* Reference */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Reference {needsReference && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={paymentMethod === "CHEQUE" ? "Cheque number" : paymentMethod === "CARD" ? "Card last 4 digits" : "Reference number"}
                className={`block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  needsReference ? "border-gray-400" : "border-gray-300"
                }`}
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal notes…"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

          </div>
        </div>
      )}

      {/* ─────────── Allocation Preview ─────────── */}
      {allocations.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm ring-1 ring-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Payment Distribution Preview</h2>
          </div>
          <div className="px-4 py-3 space-y-2">
            <p className="text-sm text-gray-600">
              Payment of <span className="font-bold text-gray-900">{numAmount.toFixed(3)} OMR</span> will be distributed as:
            </p>
            {allocations.map((a) => (
              <div key={a.invoiceId} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-100 last:border-0">
                <span className="font-mono text-gray-700">{a.invoiceNumber}</span>
                <span className="text-gray-500 text-xs">({a.balanceDue.toFixed(3)} due)</span>
                <span className="font-semibold">→ {a.applied.toFixed(3)} applied</span>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                  a.resultingStatus === "PAID"
                    ? "bg-green-100 text-green-700"
                    : "bg-orange-100 text-orange-700"
                }`}>
                  {a.resultingStatus === "PAID" ? "PAID ✓" : `Partial (${a.remaining.toFixed(3)} left)`}
                </span>
              </div>
            ))}
            {overpayment > 0 && (
              <div className="mt-2 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded px-3 py-2 border border-amber-200">
                <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0" />
                Overpayment: {overpayment.toFixed(3)} OMR — will be recorded as unapplied credit
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────── Action Buttons ─────────── */}
      {(mode === "invoice" || selectedTenant) && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSubmit(false)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
          >
            {submitting ? "Recording…" : "Record Payment"}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSubmit(true)}
            className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 disabled:opacity-50"
          >
            <PrinterIcon className="h-4 w-4" />
            {submitting ? "Recording…" : "Record & Print Receipt"}
          </button>
        </div>
      )}
    </div>
  );
}
