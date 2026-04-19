"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
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
  const tA = useTranslations("buildings.dangerZone.archive");
  const tR = useTranslations("buildings.dangerZone.restore");
  const tD = useTranslations("buildings.dangerZone.delete");
  const [confirm, setConfirm]         = useState<ConfirmState>("idle");
  const [isPending, startTransition]  = useTransition();
  const router = useRouter();

  const reset = () => setConfirm("idle");

  const handleArchive = () => {
    startTransition(async () => {
      const res = await archiveProperty(propertyId);
      if (res?.error) { toast.error(res.error); reset(); }
      else { toast.success(tA("successToast", { name: propertyName })); router.refresh(); reset(); }
    });
  };

  const handleRestore = () => {
    startTransition(async () => {
      const res = await restoreProperty(propertyId);
      if (res?.error) { toast.error(res.error); reset(); }
      else { toast.success(tR("successToast", { name: propertyName })); router.refresh(); reset(); }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const res = await deleteProperty(propertyId);
      if (res?.error) { toast.error(res.error); reset(); }
      else { toast.success(tD("successToast", { name: propertyName })); router.push("/dashboard/properties"); }
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
            <p className="text-sm font-semibold text-amber-900">{tA("title")}</p>
            <p className="mt-0.5 text-xs text-amber-700">
              {tA("body")}
            </p>
            {confirm === "archive" ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <p className="w-full text-xs font-medium text-amber-800">
                  {tA("confirmPrompt", { name: propertyName })}
                </p>
                <button
                  onClick={handleArchive}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60 transition-colors"
                >
                  <ArchiveBoxIcon className="h-3.5 w-3.5" />
                  {isPending ? tA("working") : tA("confirmYes")}
                </button>
                <button onClick={reset} disabled={isPending} className="text-xs text-gray-500 hover:text-gray-700 transition-colors">
                  {tA("cancel")}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirm("archive")}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 transition-colors"
              >
                <ArchiveBoxIcon className="h-3.5 w-3.5" />
                {tA("button")}
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
            <p className="text-sm font-semibold text-green-900">{tR("title")}</p>
            <p className="mt-0.5 text-xs text-green-700">
              {tR("body")}
            </p>
            {confirm === "restore" ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <p className="w-full text-xs font-medium text-green-800">
                  {tR("confirmPrompt", { name: propertyName })}
                </p>
                <button
                  onClick={handleRestore}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60 transition-colors"
                >
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                  {isPending ? tR("working") : tR("confirmYes")}
                </button>
                <button onClick={reset} disabled={isPending} className="text-xs text-gray-500 hover:text-gray-700 transition-colors">
                  {tR("cancel")}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirm("restore")}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-green-300 bg-white px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-50 transition-colors"
              >
                <ArrowPathIcon className="h-3.5 w-3.5" />
                {tR("button")}
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
          <p className="text-sm font-semibold text-red-800">{tD("title")}</p>
          <p className="mt-0.5 text-xs text-red-600">
            {tD("body")}
            {unitCount > 0 && (
              <>
                {tD.rich("unitsInfo", {
                  count: unitCount,
                  b: (chunks) => <strong>{chunks}</strong>,
                })}
              </>
            )}
          </p>
          {confirm === "delete" ? (
            <div className="mt-3 space-y-2">
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
                <p className="text-xs font-medium text-red-800">
                  {tD("confirmWarning")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDelete}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                  {isPending ? tD("working") : tD("confirmYes")}
                </button>
                <button onClick={reset} disabled={isPending} className="text-xs text-gray-500 hover:text-gray-700 transition-colors">
                  {tD("cancel")}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirm("delete")}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors"
            >
              <TrashIcon className="h-3.5 w-3.5" />
              {tD("button")}
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
