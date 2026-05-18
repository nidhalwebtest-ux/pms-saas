"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  CheckIcon,
  XMarkIcon,
  EyeIcon,
  TrashIcon,
  ArrowPathIcon,
  ClipboardDocumentCheckIcon,
} from "@heroicons/react/24/outline";
import type { SortingState } from "@tanstack/react-table";
import ProcessExpenseModal from "./modals/ProcessExpenseModal";
import ReceiptLightbox from "./modals/ReceiptLightbox";
import {
  buildExpenseColumns,
  expenseRowVariant,
  type ExpenseRow as Expense,
} from "./columns";
import { useFormatAmount, useOrgCurrency } from "@/lib/org-context";
import {
  DataTable,
  EmptyState,
  FilterBar,
  NoExpensesForFilters,
  NoExpensesPending,
  useConfirmDialog,
  type QuickFilter,
} from "@/components/ui";
import { ReceiptIllustration } from "@/components/ui/empty-state/illustrations";

const REJECT_REASON_KEYS = [
  "insufficient_receipt",
  "amount_too_high",
  "not_authorized",
  "wrong_category",
  "duplicate_expense",
  "other",
] as const;

export type { Expense };

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
  const tReject = useTranslations("expenses.rejectModal");
  const tReason = useTranslations("expenses.rejectModal.reasons");
  const tRejectErr = useTranslations("expenses.rejectModal.errors");
  const confirm = useConfirmDialog();
  const router = useRouter();
  const fmtAmount = useFormatAmount();
  const currency  = useOrgCurrency();

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

  // Sort
  const [sorting, setSorting] = useState<SortingState>([
    { id: "submittedAt", desc: true },
  ]);

  // Modals
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

  async function handleBulkApprove(ids: string[]) {
    if (ids.length === 0) return;
    try {
      const res = await fetch("/api/expenses/bulk-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expenseIds: ids }),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error); return; }
      toast.success(tList("toasts.bulkApproved", { count: d.approvedCount }));
      setSelectedIds(new Set());
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

  async function handleReject(e: Expense) {
    const nonOther = REJECT_REASON_KEYS.filter((k) => k !== "other") as readonly string[];
    await confirm({
      title: tReject("title"),
      description: `${e.expenseNumber} · ${e.amount.toFixed(3)} OMR`,
      tone: "destructive",
      reason: {
        label: tReject("reasonLabel"),
        placeholder: tReject("reasonPlaceholder"),
        options: REJECT_REASON_KEYS.map((k) => ({ value: k, label: tReason(k) })),
        notesFor: [...nonOther],
        notesRequiredFor: ["other"],
        notesLabel: tReject("notesLabel"),
        notesPlaceholder: tReject("notesPlaceholder"),
      },
      confirmLabel: tReject("rejectBtn"),
      cancelLabel: tReject("cancel"),
      onConfirm: async ({ reason, notes }) => {
        let res, data;
        try {
          res = await fetch(`/api/expenses/${e.id}/reject`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: tReason(reason as string), notes: notes ?? "" }),
          });
          data = await res.json();
        } catch {
          toast.error(tRejectErr("networkError"));
          throw new Error("network");
        }
        if (!res.ok) {
          toast.error(data.error ?? tRejectErr("rejectFailed"));
          throw new Error(data.error ?? "reject failed");
        }
        toast.success(tRejectErr("rejected"));
        fetchExpenses();
      },
    });
  }

  // ── Tabs ──────────────────────────────────────────────────────────────
  const tabKeys = ["ALL", "PENDING", "APPROVED", "REJECTED", "PROCESSED"] as const;
  const quickFilters: QuickFilter[] = tabKeys.map((k) => ({
    id:      k,
    label:   tTabs(k),
    count:   statusCounts[k]?.count ?? 0,
    variant: k === "REJECTED" ? "destructive" : k === "APPROVED" || k === "PROCESSED" ? "success" : k === "PENDING" ? "warning" : undefined,
  }));

  const showCheckboxes = canApprove && statusFilter === "PENDING";

  // ── Columns + row actions ─────────────────────────────────────────────
  const columns = useMemo(
    () =>
      buildExpenseColumns({
        tList,
        tStatus,
        fmtAmount,
        currency,
        onOpenReceipt: setLightboxImages,
      }),
    [tList, tStatus, fmtAmount, currency],
  );

  const rowActions = useCallback(
    (e: Expense) => {
      const isOwn = e.submittedBy.id === userId;
      const canDelete = e.status === "PENDING" && (isOwn || role === "OWNER");
      return [
        {
          id: "approve",
          label: tList("rowActions.approve"),
          icon: <CheckIcon className="h-4 w-4" />,
          visible: e.status === "PENDING" && canApprove,
          onClick: () => handleApprove(e.id),
        },
        {
          id: "reject",
          label: tList("rowActions.reject"),
          icon: <XMarkIcon className="h-4 w-4" />,
          variant: "destructive" as const,
          visible: e.status === "PENDING" && canApprove,
          onClick: () => handleReject(e),
        },
        {
          id: "process",
          label: tList("rowActions.process"),
          icon: <ClipboardDocumentCheckIcon className="h-4 w-4" />,
          visible: e.status === "APPROVED" && canProcess,
          onClick: () => setProcessExpense(e),
        },
        {
          id: "delete",
          label: tList("rowActions.delete"),
          icon: <TrashIcon className="h-4 w-4" />,
          variant: "destructive" as const,
          visible: canDelete,
          onClick: () => handleDelete(e.id),
        },
        {
          id: "view",
          label: tList("rowActions.view"),
          icon: <EyeIcon className="h-4 w-4" />,
          onClick: () => router.push(`/dashboard/expenses/${e.id}`),
        },
      ];
    },
    // handleApprove / handleReject / handleDelete are defined in the same
    // component and read from the latest state and translators.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tList, canApprove, canProcess, role, userId, router],
  );

  const bulkActions = useMemo(
    () => [
      {
        id: "approve",
        label: tList("approveSelected"),
        icon: <CheckIcon className="h-4 w-4" />,
        onClick: (ids: string[]) => handleBulkApprove(ids),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tList],
  );

  // Footer totals — kept from the original page footer.
  const footer = useMemo(() => {
    const total = expenses.reduce((s, e) => s + e.amount, 0);
    return { total, count: expenses.length };
  }, [expenses]);

  return (
    <div className="space-y-5">
      <FilterBar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: tList("searchPlaceholder"),
          debounceMs: 0, // local state already debounces via debouncedSearch
        }}
        quickFilters={quickFilters}
        activeQuickFilter={statusFilter}
        onQuickFilterChange={setStatusFilter}
        filters={[
          {
            id:       "property",
            type:     "select",
            label:    tList("allBuildings"),
            value:    propertyId,
            allValue: "",
            onChange: setPropertyId,
            options:  [
              { value: "", label: tList("allBuildings") },
              ...properties.map((p) => ({ value: p.id, label: p.name })),
            ],
          },
          {
            id:       "category",
            type:     "select",
            label:    tList("allCategories"),
            value:    categoryId,
            allValue: "",
            onChange: setCategoryId,
            options:  [
              { value: "", label: tList("allCategories") },
              ...categories.filter((c) => c.isActive).map((c) => ({
                value: c.id,
                label: `${c.icon ?? ""} ${c.name}`.trim(),
              })),
            ],
          },
        ]}
        actions={[
          {
            label:    tList("refresh"),
            onClick:  fetchExpenses,
            variant:  "ghost",
            icon:     <ArrowPathIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />,
            disabled: loading,
            iconOnlyMobile: true,
          },
        ]}
        activeFiltersDisplay="chips"
        onClearAll={() => {
          setPropertyId("");
          setCategoryId("");
        }}
      />

      {/* ── Bulk action bar ──────────────────────────────────────────── */}
      {/* ── Table ────────────────────────────────────────────────────── */}
      <DataTable<Expense>
        data={expenses}
        columns={columns}
        mode="client"
        sorting={{ state: sorting, onChange: setSorting }}
        selection={
          showCheckboxes
            ? {
                enabled: true,
                selected: selectedIds,
                onSelectionChange: setSelectedIds,
                selectionLabel: (count) => tList("selected", { count }),
                isRowSelectable: (e) => e.status === "PENDING",
              }
            : undefined
        }
        bulkActions={showCheckboxes ? bulkActions : undefined}
        rowActions={rowActions}
        rowVariant={expenseRowVariant}
        loading={loading}
        hasActiveFilters={
          !!search || statusFilter !== "ALL" || !!propertyId || !!categoryId
        }
        emptyState={
          <EmptyState
            illustration={<ReceiptIllustration />}
            title={tList("empty")}
            description={tList("emptyHint")}
          />
        }
        noResultsState={
          statusFilter === "PENDING" &&
          canApprove &&
          !search &&
          !propertyId &&
          !categoryId ? (
            <NoExpensesPending
              onViewApproved={() => setStatusFilter("APPROVED")}
            />
          ) : (
            <NoExpensesForFilters
              onClearFilters={() => {
                setStatusFilter("ALL");
                setPropertyId("");
                setCategoryId("");
                setSearch("");
              }}
            />
          )
        }
        aria-label={tList("table.expenseNumber")}
      />

      {/* Footer totals */}
      {expenses.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 text-xs text-fg-tertiary">
          <span className="font-medium text-fg">
            {tList("footerCount", { count: footer.count })}
          </span>
          <span>
            <span className="text-sm font-bold text-error-600 tabular-nums ltr-numbers">
              {fmtAmount(footer.total)}
            </span>
            <span className="text-xs text-fg-tertiary ms-1">{currency}</span>
          </span>
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────── */}
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
