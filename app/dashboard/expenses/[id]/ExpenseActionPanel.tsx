"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckIcon,
  XMarkIcon,
  ClipboardDocumentCheckIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import RejectExpenseModal from "../modals/RejectExpenseModal";
import ProcessExpenseModal from "../modals/ProcessExpenseModal";

interface Expense {
  id: string;
  expenseNumber: string;
  description: string;
  amount: number;
}

interface Props {
  expense: Expense;
  canApprove: boolean;
  canProcess: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export default function ExpenseActionPanel({
  expense, canApprove, canProcess, canEdit, canDelete,
}: Props) {
  const router = useRouter();
  const [showReject, setShowReject]   = useState(false);
  const [showProcess, setShowProcess] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleApprove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/expenses/${expense.id}/approve`, { method: "PATCH" });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error); return; }
      toast.success("Expense approved");
      router.refresh();
    } catch { toast.error("Failed to approve"); }
    finally { setBusy(false); }
  }

  async function handleDelete() {
    if (!confirm("Delete this pending expense? This cannot be undone.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/expenses/${expense.id}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error); return; }
      toast.success("Expense deleted");
      router.push("/dashboard/expenses");
    } catch { toast.error("Failed to delete"); }
    finally { setBusy(false); }
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
        <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Actions</h3>
        </div>
        <div className="p-4 space-y-2">
          {canApprove && (
            <>
              <button
                onClick={handleApprove}
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
              >
                <CheckIcon className="h-4 w-4" />
                Approve Expense
              </button>
              <button
                onClick={() => setShowReject(true)}
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-lg border border-red-200 text-red-700 bg-white hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                <XMarkIcon className="h-4 w-4" />
                Reject
              </button>
            </>
          )}

          {canProcess && (
            <button
              onClick={() => setShowProcess(true)}
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              <ClipboardDocumentCheckIcon className="h-4 w-4" />
              Mark as Processed
            </button>
          )}

          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <TrashIcon className="h-4 w-4" />
              Delete
            </button>
          )}

          {!canApprove && !canProcess && !canEdit && !canDelete && (
            <p className="text-xs text-gray-400 text-center py-2">No actions available</p>
          )}
        </div>
      </div>

      {showReject && (
        <RejectExpenseModal
          expense={expense}
          onClose={() => setShowReject(false)}
          onDone={() => { setShowReject(false); router.refresh(); }}
        />
      )}
      {showProcess && (
        <ProcessExpenseModal
          expense={expense}
          onClose={() => setShowProcess(false)}
          onDone={() => { setShowProcess(false); router.refresh(); }}
        />
      )}
    </>
  );
}
