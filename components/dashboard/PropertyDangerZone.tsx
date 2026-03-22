"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  TrashIcon,
  ArchiveBoxIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import {
  archiveProperty,
  restoreProperty,
  deleteProperty,
} from "@/app/dashboard/properties/actions";

type ConfirmState = "idle" | "archive" | "restore" | "delete";

interface Props {
  propertyId:   string;
  propertyName: string;
  unitCount:    number;
  isArchived:   boolean;
}

export default function PropertyDangerZone({
  propertyId,
  propertyName,
  unitCount,
  isArchived,
}: Props) {
  const [confirm, setConfirm]         = useState<ConfirmState>("idle");
  const [isPending, startTransition]  = useTransition();
  const router = useRouter();

  const reset = () => setConfirm("idle");

  const handleArchive = () => {
    startTransition(async () => {
      const res = await archiveProperty(propertyId);
      if (res?.error) { toast.error(res.error); reset(); }
      else { toast.success(`"${propertyName}" has been archived.`); router.refresh(); reset(); }
    });
  };

  const handleRestore = () => {
    startTransition(async () => {
      const res = await restoreProperty(propertyId);
      if (res?.error) { toast.error(res.error); reset(); }
      else { toast.success(`"${propertyName}" has been restored.`); router.refresh(); reset(); }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const res = await deleteProperty(propertyId);
      if (res?.error) { toast.error(res.error); reset(); }
      else { toast.success(`"${propertyName}" has been permanently deleted.`); router.push("/dashboard/properties"); }
    });
  };

  return (
    <div className="space-y-3">

      {/* ── Archive / Restore row ──────────────────────────────── */}
      {!isArchived ? (
        <div className="flex items-start gap-4 rounded-xl border border-amber-100 bg-amber-50/50 p-4">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100">
            <ArchiveBoxIcon className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">Archive this building</p>
            <p className="mt-0.5 text-xs text-amber-700">
              Hides it from all lists. All units, reservations, and history are fully preserved.
              You can restore it at any time.
            </p>
            {confirm === "archive" ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <p className="w-full text-xs font-medium text-amber-800">
                  Archive &ldquo;{propertyName}&rdquo;? It will be hidden from all views.
                </p>
                <button
                  onClick={handleArchive}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60 transition-colors"
                >
                  <ArchiveBoxIcon className="h-3.5 w-3.5" />
                  {isPending ? "Archiving…" : "Yes, Archive"}
                </button>
                <button onClick={reset} disabled={isPending} className="text-xs text-gray-500 hover:text-gray-700 transition-colors">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirm("archive")}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 transition-colors"
              >
                <ArchiveBoxIcon className="h-3.5 w-3.5" />
                Archive Building
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-4 rounded-xl border border-green-100 bg-green-50/50 p-4">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-green-100">
            <ArrowPathIcon className="h-5 w-5 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-green-900">Restore this building</p>
            <p className="mt-0.5 text-xs text-green-700">
              Makes it visible again in the buildings list. You can then re-activate it for bookings.
            </p>
            {confirm === "restore" ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <p className="w-full text-xs font-medium text-green-800">
                  Restore &ldquo;{propertyName}&rdquo;? It will reappear in the buildings list.
                </p>
                <button
                  onClick={handleRestore}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60 transition-colors"
                >
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                  {isPending ? "Restoring…" : "Yes, Restore"}
                </button>
                <button onClick={reset} disabled={isPending} className="text-xs text-gray-500 hover:text-gray-700 transition-colors">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirm("restore")}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-green-300 bg-white px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-50 transition-colors"
              >
                <ArrowPathIcon className="h-3.5 w-3.5" />
                Restore Building
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Permanent delete row ───────────────────────────────── */}
      <div className="flex items-start gap-4 rounded-xl border border-red-100 bg-red-50/40 p-4">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-red-100">
          <TrashIcon className="h-5 w-5 text-red-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-red-800">Delete permanently</p>
          <p className="mt-0.5 text-xs text-red-600">
            Removes this building and all its units forever. Active reservations will block deletion.
            {unitCount > 0 && (
              <> This building has <strong>{unitCount} unit{unitCount !== 1 ? "s" : ""}</strong> that will also be removed.</>
            )}
          </p>
          {confirm === "delete" ? (
            <div className="mt-3 space-y-2">
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
                <p className="text-xs font-medium text-red-800">
                  This cannot be undone. All units and their history will be lost.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDelete}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                  {isPending ? "Deleting…" : "Delete Forever"}
                </button>
                <button onClick={reset} disabled={isPending} className="text-xs text-gray-500 hover:text-gray-700 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirm("delete")}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors"
            >
              <TrashIcon className="h-3.5 w-3.5" />
              Delete Building
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
