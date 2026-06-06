"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Combobox } from "@headlessui/react";
import { useTranslations, useLocale } from "next-intl";
import { format } from "date-fns";
import { ar as arLocale, enGB as enLocale } from "date-fns/locale";
import {
  UserCircleIcon,
  DocumentTextIcon,
  BanknotesIcon,
  PrinterIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ChevronUpDownIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import { Alert, Button } from "@/components/ui";

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
  const router  = useRouter();
  const locale  = useLocale();
  const dfLoc   = locale === "ar" ? arLocale : enLocale;
  const tForm   = useTranslations("payments.form");
  const tMethod = useTranslations("payments.methods");
  const tErr    = useTranslations("payments.form.errors");

  const fmtPeriod = (start: string | null, end: string | null) => {
    if (!start || !end) return "";
    const s = format(new Date(start), "d MMM", { locale: dfLoc });
    const e = format(new Date(end), "d MMM yyyy", { locale: dfLoc });
    return `${s} – ${e}`;
  };

  const fmtDateShort = (d: string) =>
    format(new Date(d), "dd/MM/yyyy", { locale: dfLoc });

  // ── State ─────────────────────────────────────────────────────────────────
  const [mode]                            = useState<"tenant" | "invoice">(preselectedInvoiceId ? "invoice" : "tenant");

  // Tenant search (Combobox)
  const [tenantQuery, setTenantQuery]     = useState("");
  const [tenantResults, setTenantResults] = useState<TenantResult[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<TenantResult | null>(null);
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
      toast.error(tErr("loadInvoices"));
    } finally {
      setLoadingInvoices(false);
    }
  }, [tErr]);

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
  function onTenantQueryChange(val: string) {
    setTenantQuery(val);
    clearTimeout(searchTimeout.current);
    if (val.trim().length < 2) { setTenantResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/tenants?search=${encodeURIComponent(val)}&limit=10`);
        const data = await res.json();
        setTenantResults(data.tenants ?? []);
      } catch { /* ignore */ }
    }, 300);
  }

  function pickTenant(t: TenantResult | null) {
    setSelectedTenant(t);
    if (!t) {
      setTenantQuery("");
      setInvoices([]);
      setSelectedInvoiceIds(new Set());
      setAmount("");
    }
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
      toast.error(tErr("selectTenant"));
      return;
    }
    if (!amount || numAmount <= 0) {
      toast.error(tErr("validAmount"));
      return;
    }
    if ((paymentMethod === "CARD" || paymentMethod === "BANK_TRANSFER" || paymentMethod === "CHEQUE") && !reference) {
      toast.error(tErr("referenceRequired"));
      return;
    }

    // Resolve tenantId
    let effectiveTenantId: string | undefined;
    if (mode === "tenant") {
      effectiveTenantId = selectedTenant!.id;
    } else if (mode === "invoice" && preInvoice) {
      try {
        const res  = await fetch(`/api/invoices/${preInvoice.id}`);
        const data = await res.json();
        effectiveTenantId = data.invoice?.tenantId ?? data.tenantId;
      } catch {
        toast.error(tErr("resolveTenant"));
        return;
      }
    }

    if (!effectiveTenantId) {
      toast.error(tErr("couldNotResolve"));
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
        toast.error(data.error ?? tErr("recordFailed"));
        return;
      }
      const payId = data.payment?.id ?? data.id;
      toast.success(tErr("recorded"));
      if (printAfter && payId) {
        window.open(`/api/payments/${payId}/receipt-pdf`, "_blank");
      }
      router.push(payId ? `/dashboard/payments/${payId}` : "/dashboard/payments");
    } catch {
      toast.error(tErr("networkError"));
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────
  const needsReference = paymentMethod !== "CASH";
  const referencePlaceholder =
    paymentMethod === "CHEQUE" ? tForm("referenceCheque")
    : paymentMethod === "CARD" ? tForm("referenceCard")
    : tForm("referenceGeneric");

  return (
    <div className="space-y-6">

      {/* ─────────── Mode A: Invoice pre-selected ─────────── */}
      {mode === "invoice" && preInvoice && (
        <div className="bg-white rounded-lg shadow-sm ring-1 ring-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
            <DocumentTextIcon className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">{tForm("invoiceCard")}</h2>
          </div>
          <div className="px-4 py-4 flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm font-bold text-gray-900 font-mono ltr-numbers">{preInvoice.invoiceNumber}</p>
              <p className="text-xs text-gray-500 ltr-numbers">{fmtPeriod(preInvoice.periodStart, preInvoice.periodEnd)}</p>
              <p className="text-xs text-gray-500 ltr-numbers">{tForm("totalLabel", { total: preInvoice.totalAmount.toFixed(3) })}</p>
            </div>
            <div className="text-end">
              <p className="text-xs text-gray-500">{tForm("balanceDueLabel")}</p>
              <p className="text-lg font-bold text-red-600 ltr-numbers">{preInvoice.balanceDue.toFixed(3)} OMR</p>
            </div>
          </div>
        </div>
      )}

      {/* ─────────── Mode B: Tenant search ─────────── */}
      {/* No overflow-hidden here: it would clip the tenant search dropdown (QA #49). */}
      {mode === "tenant" && (
        <div className="bg-white rounded-lg shadow-sm ring-1 ring-gray-200">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 rounded-t-lg flex items-center gap-2">
            <UserCircleIcon className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">{tForm("step1Tenant")}</h2>
          </div>
          <div className="px-4 py-4">
            <Combobox
              as="div"
              value={selectedTenant}
              onChange={pickTenant}
            >
              <div className="relative">
                <div className="relative">
                  <Combobox.Input
                    className="w-full rounded-md border-0 bg-white py-2 ps-3 pe-10 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                    displayValue={(t: TenantResult | null) =>
                      t ? `${t.firstName} ${t.lastName}` : ""
                    }
                    onChange={(e) => onTenantQueryChange(e.target.value)}
                    placeholder={tForm("tenantSearchPlaceholder")}
                  />
                  <Combobox.Button className="absolute inset-y-0 end-0 flex items-center pe-2">
                    <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                  </Combobox.Button>
                </div>

                {tenantResults.length > 0 && (
                  <Combobox.Options className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                    {tenantResults.map((t) => (
                      <Combobox.Option
                        key={t.id}
                        value={t}
                        className={({ active }) =>
                          `relative cursor-pointer select-none py-2 ps-3 pe-9 ${
                            active ? "bg-blue-600 text-white" : "text-gray-900"
                          }`
                        }
                      >
                        {({ active, selected }) => (
                          <>
                            <div className="flex items-center justify-between gap-3">
                              <span className={`block truncate ${selected ? "font-semibold" : "font-normal"}`}>
                                {t.firstName} {t.lastName}
                              </span>
                              <span className={`text-xs ltr-numbers ${active ? "text-blue-200" : "text-gray-500"}`}>
                                {t.phone}
                              </span>
                            </div>
                            {selected && (
                              <span className={`absolute inset-y-0 end-0 flex items-center pe-4 ${active ? "text-white" : "text-blue-600"}`}>
                                <CheckIcon className="h-5 w-5" aria-hidden="true" />
                              </span>
                            )}
                          </>
                        )}
                      </Combobox.Option>
                    ))}
                  </Combobox.Options>
                )}
              </div>
            </Combobox>
          </div>
        </div>
      )}

      {/* ─────────── Invoice selection (Mode B) ─────────── */}
      {mode === "tenant" && selectedTenant && (
        <div className="bg-white rounded-lg shadow-sm ring-1 ring-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DocumentTextIcon className="h-4 w-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-700">{tForm("step2Invoices")}</h2>
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
                {tForm("selectAll")}
              </label>
            )}
          </div>
          {loadingInvoices ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">{tForm("loadingInvoices")}</div>
          ) : invoices.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <CheckCircleIcon className="mx-auto h-8 w-8 text-green-400 mb-2" />
              <p className="text-sm text-gray-500">{tForm("noOutstanding")}</p>
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
                        <span className="text-sm font-mono font-semibold text-gray-900 ltr-numbers">{inv.invoiceNumber}</span>
                        {overdue && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                            <ExclamationTriangleIcon className="h-3 w-3" /> {tForm("overdue")}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 ltr-numbers">{fmtPeriod(inv.periodStart, inv.periodEnd)}</p>
                      <p className="text-xs text-gray-400 ltr-numbers">{tForm("dueLabel", { date: fmtDateShort(inv.dueDate) })}</p>
                    </div>
                    <div className="text-end flex-shrink-0">
                      <p className="text-sm font-bold text-red-600 ltr-numbers">{Number(inv.balanceDue).toFixed(3)} OMR</p>
                      <p className="text-xs text-gray-400 ltr-numbers">{tForm("ofTotal", { total: Number(inv.totalAmount).toFixed(3) })}</p>
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
              {mode === "invoice" ? tForm("step2Details") : tForm("step3Details")}
            </h2>
          </div>
          <div className="px-4 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Amount */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {tForm("amountLabel")} <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={tForm("amountPlaceholder")}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ltr-numbers"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{tForm("date")}</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ltr-numbers"
              />
            </div>

            {/* Method */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-2">
                {tForm("paymentMethod")} <span className="text-red-500">*</span>
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
                    {tMethod(m)}
                  </label>
                ))}
              </div>
            </div>

            {/* Reference */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {tForm("reference")} {needsReference && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={referencePlaceholder}
                className={`block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  needsReference ? "border-gray-400" : "border-gray-300"
                }`}
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{tForm("notesOptional")}</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={tForm("notesPlaceholder")}
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
            <h2 className="text-sm font-semibold text-gray-700">{tForm("distributionPreview")}</h2>
          </div>
          <div className="px-4 py-3 space-y-2">
            <p className="text-sm text-gray-600 ltr-numbers">
              {tForm("distributionLine", { amount: numAmount.toFixed(3) })}
            </p>
            {allocations.map((a) => (
              <div key={a.invoiceId} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-100 last:border-0">
                <span className="font-mono text-gray-700 ltr-numbers">{a.invoiceNumber}</span>
                <span className="text-gray-500 text-xs ltr-numbers">{tForm("dueShort", { due: a.balanceDue.toFixed(3) })}</span>
                <span className="font-semibold ltr-numbers">{tForm("appliedShort", { applied: a.applied.toFixed(3) })}</span>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                  a.resultingStatus === "PAID"
                    ? "bg-green-100 text-green-700"
                    : "bg-orange-100 text-orange-700"
                }`}>
                  {a.resultingStatus === "PAID" ? tForm("paidStatus") : tForm("partialStatus", { remaining: a.remaining.toFixed(3) })}
                </span>
              </div>
            ))}
            {overpayment > 0 && (
              <Alert
                variant="warning"
                size="sm"
                className="mt-2"
                description={tForm("overpaymentNotice", { amount: overpayment.toFixed(3) })}
              />
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
            {tForm("cancel")}
          </button>
          <Button
            type="button"
            onClick={() => handleSubmit(false)}
            loading={submitting}
          >
            {tForm("recordPayment")}
          </Button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSubmit(true)}
            className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 disabled:opacity-50"
          >
            <PrinterIcon className="h-4 w-4" />
            {submitting ? tForm("recording") : tForm("recordAndPrint")}
          </button>
        </div>
      )}
    </div>
  );
}
