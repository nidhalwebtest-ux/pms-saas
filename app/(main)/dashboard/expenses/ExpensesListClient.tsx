"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  CheckIcon,
  XMarkIcon,
  EyeIcon,
  TrashIcon,
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

const PAGE_SIZE = 25;

export type { Expense };

interface Props {
  role: string;
  userId: string;
  initialStatus: string;
  expenses: Expense[];
  properties: { id: string; name: string }[];
  categories: { id: string; name: string; icon: string | null; isActive: boolean }[];
}


export default function ExpensesListClient({
  role, userId, initialStatus, expenses, properties, categories,
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

  // ── Filters (all client-side, instant — no DB refetch) ──────────────────
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [propertyId, setPropertyId]     = useState("");
  const [categoryId, setCategoryId]     = useState("");
  const [search, setSearch]             = useState("");
  const [pageIndex, setPageIndex]       = useState(0);

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

  // After a mutation, re-pull the server component data and clear selection.
  const refresh = useCallback(() => {
    setSelectedIds(new Set());
    router.refresh();
  }, [router]);

  // ── Tab counts (client-side, computed over the property/category/search-
  //    filtered set so the counts track the active secondary filters) ──────
  const baseFiltered = useMemo(() => {
    let rows = expenses;
    if (propertyId) rows = rows.filter((e) => e.property.id === propertyId);
    if (categoryId) rows = rows.filter((e) => e.category.id === categoryId);
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((e) =>
        e.description.toLowerCase().includes(q) ||
        e.expenseNumber.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [expenses, propertyId, categoryId, search]);

  const statusCounts = useMemo(() => {
    const acc: Record<string, { count: number; total: number }> = {
      ALL: { count: 0, total: 0 },
      PENDING: { count: 0, total: 0 },
      APPROVED: { count: 0, total: 0 },
      REJECTED: { count: 0, total: 0 },
      PROCESSED: { count: 0, total: 0 },
    };
    for (const e of baseFiltered) {
      acc.ALL.count++;
      acc.ALL.total += e.amount;
      const s = acc[e.status];
      if (s) { s.count++; s.total += e.amount; }
    }
    return acc;
  }, [baseFiltered]);

  // ── Filtered rows for the table ─────────────────────────────────────────
  const filtered = useMemo(() => {
    if (statusFilter && statusFilter !== "ALL") {
      return baseFiltered.filter((e) => e.status === statusFilter);
    }
    return baseFiltered;
  }, [baseFiltered, statusFilter]);

  // ── Actions ───────────────────────────────────────────────────────────
  async function handleApprove(id: string) {
    const exp = expenses.find((e) => e.id === id);
    const { confirmed } = await confirm({
      title: tList("approveConfirm.title"),
      description: exp
        ? tList("approveConfirm.body", { number: exp.expenseNumber, amount: exp.amount.toFixed(3) })
        : tList("approveConfirm.bodyGeneric"),
      confirmLabel: tList("approveConfirm.cta"),
      cancelLabel: tList("approveConfirm.cancel"),
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/expenses/${id}/approve`, { method: "PATCH" });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error); return; }
      toast.success(tList("toasts.approved"));
      refresh();
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
      refresh();
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
      refresh();
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
        refresh();
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

  // Footer totals — computed over the filtered rows.
  const footer = useMemo(() => {
    const total = filtered.reduce((s, e) => s + e.amount, 0);
    return { total, count: filtered.length };
  }, [filtered]);

  return (
    <div className="space-y-5">
      <FilterBar
        search={{
          value: search,
          onChange: (v) => { setSearch(v); setPageIndex(0); },
          placeholder: tList("searchPlaceholder"),
        }}
        quickFilters={quickFilters}
        activeQuickFilter={statusFilter}
        onQuickFilterChange={(s) => { setStatusFilter(s); setPageIndex(0); }}
        filters={[
          {
            id:       "property",
            type:     "select",
            label:    tList("allBuildings"),
            value:    propertyId,
            allValue: "",
            onChange: (v) => { setPropertyId(v); setPageIndex(0); },
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
            onChange: (v) => { setCategoryId(v); setPageIndex(0); },
            options:  [
              { value: "", label: tList("allCategories") },
              ...categories.filter((c) => c.isActive).map((c) => ({
                value: c.id,
                label: `${c.icon ?? ""} ${c.name}`.trim(),
              })),
            ],
          },
        ]}
        activeFiltersDisplay="chips"
        onClearAll={() => {
          setPropertyId("");
          setCategoryId("");
          setPageIndex(0);
        }}
      />

      {/* ── Table ────────────────────────────────────────────────────── */}
      <DataTable<Expense>
        data={filtered}
        columns={columns}
        mode="client"
        sorting={{ state: sorting, onChange: setSorting }}
        pagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          onChange: ({ pageIndex: next }) => setPageIndex(next),
        }}
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
                setPageIndex(0);
              }}
            />
          )
        }
        aria-label={tList("table.expenseNumber")}
      />

      {/* Footer totals */}
      {filtered.length > 0 && (
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
          onDone={() => { setProcessExpense(null); refresh(); }}
        />
      )}
      {lightboxImages && (
        <ReceiptLightbox images={lightboxImages} onClose={() => setLightboxImages(null)} />
      )}
    </div>
  );
}
