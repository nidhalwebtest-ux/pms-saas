"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { format } from "date-fns";
import { ar as arLocale, enGB as enLocale } from "date-fns/locale";
import {
  MagnifyingGlassIcon,
  CheckIcon,
  XMarkIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  PhotoIcon,
  ArrowPathIcon,
  ClipboardDocumentCheckIcon,
} from "@heroicons/react/24/outline";
import RejectExpenseModal from "./modals/RejectExpenseModal";
import ProcessExpenseModal from "./modals/ProcessExpenseModal";
import ReceiptLightbox from "./modals/ReceiptLightbox";
import { useFormatAmount, useOrgCurrency } from "@/lib/org-context";
import { Badge, getExpenseStatusBadge, useConfirmDialog, type ExpenseStatusKey } from "@/components/ui";

type Status = "PENDING" | "APPROVED" | "REJECTED" | "PROCESSED";

interface Expense {
  id: string;
  expenseNumber: string;
  description: string;
  amount: number;
  status: Status;
  receiptImage: string;
  receiptImage2: string | null;
  notes: string | null;
  rejectionReason: string | null;
  paymentMethod: string | null;
  bankReference: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  processedAt: string | null;
  category: { id: string; name: string; icon: string | null; nameAr: string | null };
  property: { id: string; name: string };
  submittedBy: { id: string; firstName: string | null; lastName: string | null };
  reviewedBy: { id: string; firstName: string | null; lastName: string | null } | null;
  processedBy: { id: string; firstName: string | null; lastName: string | null } | null;
}

interface Props {
  role: string;
  userId: string;
  initialStatus: string;
  initialPropertyId: string;
  initialCategoryId: string;
  properties: { id: string; name: string }[];
  categories: { id: string; name: string; icon: string | null; isActive: boolean }[];
}


export default function ExpensesListClient({
  role, userId, initialStatus, initialPropertyId, initialCategoryId, properties, categories,
}: Props) {
  const tList = useTranslations("expenses.list");
  const tStatus = useTranslations("expenses.statuses");
  const tTabs = useTranslations("expenses.tabs");
  const confirm = useConfirmDialog();
  const locale = useLocale();
  const dfLoc = locale === "ar" ? arLocale : enLocale;
  const fmtAmount = useFormatAmount();
  const currency  = useOrgCurrency();

  const fmtDate = (d: string | null) => {
    if (!d) return "—";
    return format(new Date(d), "dd MMM yyyy", { locale: dfLoc });
  };

  const fullName = (u: { firstName: string | null; lastName: string | null } | null) => {
    if (!u) return "—";
    return [u.firstName, u.lastName].filter(Boolean).join(" ") || "—";
  };

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, { count: number; total: number }>>({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter]   = useState(initialStatus);
  const [propertyId, setPropertyId]       = useState(initialPropertyId);
  const [categoryId, setCategoryId]       = useState(initialCategoryId);
  const [search, setSearch]               = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Selection (bulk approve)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals
  const [rejectExpense, setRejectExpense]   = useState<Expense | null>(null);
  const [processExpense, setProcessExpense] = useState<Expense | null>(null);
  const [lightboxImages, setLightboxImages] = useState<string[] | null>(null);

  const canApprove = ["OWNER", "MANAGER"].includes(role);
  const canProcess = ["OWNER", "ACCOUNTANT"].includes(role);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // ── Fetch ─────────────────────────────────────────────────────────────
  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "ALL") params.set("status", statusFilter);
      if (propertyId) params.set("propertyId", propertyId);
      if (categoryId) params.set("categoryId", categoryId);
      if (debouncedSearch) params.set("search", debouncedSearch);
      params.set("limit", "200");

      const res = await fetch(`/api/expenses?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? tList("toasts.loadFailed")); return; }
      setExpenses(data.expenses ?? []);
      setStatusCounts(data.statusCounts ?? {});
      setSelectedIds(new Set()); // reset selection on refilter
    } catch {
      toast.error(tList("toasts.networkError"));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, propertyId, categoryId, debouncedSearch, tList]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  // ── Footer totals ─────────────────────────────────────────────────────
  const footer = useMemo(() => {
    const total = expenses.reduce((s, e) => s + e.amount, 0);
    return { total, count: expenses.length };
  }, [expenses]);

  // ── Actions ───────────────────────────────────────────────────────────
  async function handleApprove(id: string) {
    try {
      const res = await fetch(`/api/expenses/${id}/approve`, { method: "PATCH" });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error); return; }
      toast.success(tList("toasts.approved"));
      fetchExpenses();
    } catch { toast.error(tList("toasts.approveFailed")); }
  }

  async function handleBulkApprove() {
    if (selectedIds.size === 0) return;
    try {
      const res = await fetch("/api/expenses/bulk-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expenseIds: Array.from(selectedIds) }),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error); return; }
      toast.success(tList("toasts.bulkApproved", { count: d.approvedCount }));
      fetchExpenses();
    } catch { toast.error(tList("toasts.bulkApproveFailed")); }
  }

  async function handleDelete(id: string) {
    const { confirmed } = await confirm({
      title: tList("toasts.deleteTitle"),
      description: tList("toasts.deleteConfirm"),
      tone: "destructive",
      confirmLabel: tList("toasts.deleteCta"),
      cancelLabel: tList("toasts.cancelCta"),
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error); return; }
      toast.success(tList("toasts.deleted"));
      fetchExpenses();
    } catch { toast.error(tList("toasts.deleteFailed")); }
  }

  // ── Selection ─────────────────────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleSelectAll() {
    const pending = expenses.filter((e) => e.status === "PENDING");
    if (selectedIds.size === pending.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(pending.map((e) => e.id)));
  }

  // ── Tabs ──────────────────────────────────────────────────────────────
  const tabs: { key: string }[] = [
    { key: "ALL" },
    { key: "PENDING" },
    { key: "APPROVED" },
    { key: "REJECTED" },
    { key: "PROCESSED" },
  ];

  const showCheckboxes = canApprove && statusFilter === "PENDING";
  const pendingCount = expenses.filter((e) => e.status === "PENDING").length;

  return (
    <div className="space-y-5">
      {/* ── Status tabs ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((tb) => {
            const active = statusFilter === tb.key;
            const count = statusCounts[tb.key]?.count ?? 0;
            const total = statusCounts[tb.key]?.total ?? 0;
            return (
              <button
                key={tb.key}
                onClick={() => setStatusFilter(tb.key)}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-full transition-all ${
                  active
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {tTabs(tb.key)}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ltr-numbers ${
                  active ? "bg-blue-500/40 text-white" : "bg-white text-gray-500"
                }`}>
                  {count}
                </span>
                {active && total > 0 && (
                  <span className="text-[10px] font-medium opacity-80 ltr-numbers">
                    · {fmtAmount(total)}
                  </span>
                )}
              </button>
            );
          })}
          <button
            onClick={fetchExpenses}
            disabled={loading}
            className="ms-auto p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40"
            title={tList("refresh")}
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── Filters bar ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 px-4 py-3 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="relative sm:col-span-2">
          <MagnifyingGlassIcon className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tList("searchPlaceholder")}
            className="w-full rounded-lg border-0 bg-white py-2 ps-9 pe-3 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600"
          />
        </div>
        <select
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          className="w-full rounded-lg border-0 bg-white py-2 px-3 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600"
        >
          <option value="">{tList("allBuildings")}</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full rounded-lg border-0 bg-white py-2 px-3 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600"
        >
          <option value="">{tList("allCategories")}</option>
          {categories.filter(c => c.isActive).map((c) => (
            <option key={c.id} value={c.id}>{c.icon ?? ""} {c.name}</option>
          ))}
        </select>
      </div>

      {/* ── Bulk action bar ──────────────────────────────────────────── */}
      {showCheckboxes && selectedIds.size > 0 && (
        <div className="bg-blue-50 ring-1 ring-blue-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-blue-700">
            {tList("selected", { count: selectedIds.size })}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              {tList("clearSelection")}
            </button>
            <button
              onClick={handleBulkApprove}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
            >
              <CheckIcon className="h-3.5 w-3.5" />
              {tList("approveSelected")}
            </button>
          </div>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <ArrowPathIcon className="mx-auto h-6 w-6 text-gray-300 animate-spin mb-2" />
            <p className="text-sm text-gray-400">{tList("loading")}</p>
          </div>
        ) : expenses.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <ClipboardDocumentCheckIcon className="h-6 w-6 text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-400">{tList("empty")}</p>
            <p className="text-xs text-gray-300 mt-1">{tList("emptyHint")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {showCheckboxes && (
                    <th className="py-3 ps-5 pe-2 w-8">
                      <input
                        type="checkbox"
                        checked={selectedIds.size > 0 && selectedIds.size === pendingCount}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                  )}
                  <th className="py-3 px-3 text-start text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{tList("table.expenseNumber")}</th>
                  <th className="px-3 py-3 text-start text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{tList("table.date")}</th>
                  <th className="px-3 py-3 text-start text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{tList("table.category")}</th>
                  <th className="px-3 py-3 text-start text-xs font-semibold text-gray-500 uppercase tracking-wide">{tList("table.description")}</th>
                  <th className="px-3 py-3 text-start text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{tList("table.building")}</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">{tList("table.receipt")}</th>
                  <th className="px-3 py-3 text-start text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{tList("table.submittedBy")}</th>
                  <th className="px-3 py-3 text-end text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{tList("table.amount")}</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">{tList("table.status")}</th>
                  <th className="px-3 py-3 pe-5 text-end text-xs font-semibold text-gray-500 uppercase tracking-wide">{tList("table.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {expenses.map((e, idx) => {
                  const isOwn = e.submittedBy.id === userId;
                  const canEdit   = e.status === "PENDING" && isOwn;
                  const canDelete = e.status === "PENDING" && (isOwn || role === "OWNER");

                  return (
                    <tr
                      key={e.id}
                      className={`transition-colors hover:bg-gray-50/70 ${idx % 2 === 0 ? "" : "bg-gray-50/30"}`}
                    >
                      {showCheckboxes && (
                        <td className="py-3 ps-5 pe-2">
                          {e.status === "PENDING" && (
                            <input
                              type="checkbox"
                              checked={selectedIds.has(e.id)}
                              onChange={() => toggleSelect(e.id)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          )}
                        </td>
                      )}
                      <td className="whitespace-nowrap py-3 px-3 text-sm">
                        <Link href={`/dashboard/expenses/${e.id}`} className="font-mono text-xs font-semibold text-blue-600 hover:underline ltr-numbers">
                          {e.expenseNumber}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-600 ltr-numbers">
                        {fmtDate(e.submittedAt)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-700">
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          <span className="text-base">{e.category.icon ?? "📋"}</span>
                          {e.category.name}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-700 max-w-[280px]">
                        <span className="block truncate" title={e.description}>{e.description}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-600">
                        {e.property.name}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => setLightboxImages([e.receiptImage, ...(e.receiptImage2 ? [e.receiptImage2] : [])])}
                          className="inline-flex items-center justify-center h-9 w-9 rounded-lg overflow-hidden ring-1 ring-gray-200 hover:ring-blue-400 transition-all bg-gray-50"
                          title={tList("rowActions.viewReceipt")}
                        >
                          {e.receiptImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={e.receiptImage} alt={tList("table.receipt")} className="object-cover w-full h-full" />
                          ) : (
                            <PhotoIcon className="h-4 w-4 text-gray-300" />
                          )}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-600">
                        {fullName(e.submittedBy)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-end">
                        <span className="text-sm font-bold text-red-600 tabular-nums ltr-numbers">
                          {fmtAmount(e.amount)}
                        </span>
                        <span className="text-[10px] text-gray-400 ms-1">{currency}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-center">
                        <Badge
                          {...getExpenseStatusBadge(e.status as ExpenseStatusKey)}
                          size="sm"
                          pulse={e.status === "PENDING"}
                        >
                          {tStatus(e.status)}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 pe-5 text-end">
                        <div className="inline-flex items-center gap-1">
                          {/* Pending + Manager: Approve / Reject inline */}
                          {e.status === "PENDING" && canApprove && (
                            <>
                              <button
                                onClick={() => handleApprove(e.id)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded text-white bg-emerald-600 hover:bg-emerald-500"
                                title={tList("rowActions.approve")}
                              >
                                <CheckIcon className="h-3 w-3" />
                                {tList("rowActions.approve")}
                              </button>
                              <button
                                onClick={() => setRejectExpense(e)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded text-red-700 bg-white border border-red-200 hover:bg-red-50"
                                title={tList("rowActions.reject")}
                              >
                                <XMarkIcon className="h-3 w-3" />
                                {tList("rowActions.reject")}
                              </button>
                            </>
                          )}
                          {/* Approved + Accountant: Process */}
                          {e.status === "APPROVED" && canProcess && (
                            <button
                              onClick={() => setProcessExpense(e)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded text-white bg-blue-600 hover:bg-blue-500"
                            >
                              <ClipboardDocumentCheckIcon className="h-3 w-3" />
                              {tList("rowActions.process")}
                            </button>
                          )}
                          {/* Edit pending (own) */}
                          {canEdit && (
                            <Link
                              href={`/dashboard/expenses/${e.id}`}
                              className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                              title={tList("rowActions.edit")}
                            >
                              <PencilIcon className="h-3.5 w-3.5" />
                            </Link>
                          )}
                          {/* Delete pending (own) */}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(e.id)}
                              className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                              title={tList("rowActions.delete")}
                            >
                              <TrashIcon className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {/* View always */}
                          <Link
                            href={`/dashboard/expenses/${e.id}`}
                            className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                            title={tList("rowActions.view")}
                          >
                            <EyeIcon className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td colSpan={showCheckboxes ? 8 : 7} className="px-5 py-3 text-sm font-semibold text-gray-700">
                    {tList("footerCount", { count: footer.count })}
                  </td>
                  <td className="px-3 py-3 text-end">
                    <span className="text-sm font-bold text-red-600 tabular-nums ltr-numbers">
                      {fmtAmount(footer.total)}
                    </span>
                    <span className="text-xs text-gray-400 ms-1">{currency}</span>
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────────────── */}
      {rejectExpense && (
        <RejectExpenseModal
          expense={rejectExpense}
          onClose={() => setRejectExpense(null)}
          onDone={() => { setRejectExpense(null); fetchExpenses(); }}
        />
      )}
      {processExpense && (
        <ProcessExpenseModal
          expense={processExpense}
          onClose={() => setProcessExpense(null)}
          onDone={() => { setProcessExpense(null); fetchExpenses(); }}
        />
      )}
      {lightboxImages && (
        <ReceiptLightbox images={lightboxImages} onClose={() => setLightboxImages(null)} />
      )}
    </div>
  );
}
