"use client";

import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  TrashIcon,
  ArchiveBoxIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import {
  archiveProperty,
  restoreProperty,
  deleteProperty,
} from "@/app/dashboard/properties/actions";
import { useConfirmDialog } from "@/components/ui";

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
  const confirm = useConfirmDialog();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleArchive = async () => {
    const { confirmed } = await confirm({
      title: tA("title"),
      description: tA("confirmPrompt", { name: propertyName }),
      tone: "warning",
      confirmLabel: tA("confirmYes"),
      cancelLabel: tA("cancel"),
    });
    if (!confirmed) return;
    startTransition(async () => {
      const res = await archiveProperty(propertyId);
      if (res?.error) toast.error(res.error);
      else { toast.success(tA("successToast", { name: propertyName })); router.refresh(); }
    });
  };

  const handleRestore = async () => {
    const { confirmed } = await confirm({
      title: tR("title"),
      description: tR("confirmPrompt", { name: propertyName }),
      tone: "info",
      confirmLabel: tR("confirmYes"),
      cancelLabel: tR("cancel"),
    });
    if (!confirmed) return;
    startTransition(async () => {
      const res = await restoreProperty(propertyId);
      if (res?.error) toast.error(res.error);
      else { toast.success(tR("successToast", { name: propertyName })); router.refresh(); }
    });
  };

  const deleteBody: ReactNode = (
    <div className="space-y-2 text-sm text-fg-secondary">
      <p>
        {tD("body")}
        {unitCount > 0 && (
          <>{tD.rich("unitsInfo", { count: unitCount, b: (chunks) => <strong>{chunks}</strong> })}</>
        )}
      </p>
      <p className="rounded-md border border-error-200 bg-error-50 px-3 py-2 text-xs font-medium text-error-700">
        {tD("confirmWarning")}
      </p>
    </div>
  );

  const handleDelete = async () => {
    const { confirmed } = await confirm({
      title: tD("title"),
      tone: "destructive",
      body: deleteBody,
      typeToConfirm: {
        value: propertyName,
        label: tD("typeToConfirmLabel", { name: propertyName }),
      },
      confirmLabel: tD("confirmYes"),
      cancelLabel: tD("cancel"),
    });
    if (!confirmed) return;
    startTransition(async () => {
      const res = await deleteProperty(propertyId);
      if (res?.error) toast.error(res.error);
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
            <button
              onClick={handleArchive}
              disabled={isPending}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 transition-colors disabled:opacity-60"
            >
              <ArchiveBoxIcon className="h-3.5 w-3.5" />
              {tA("button")}
            </button>
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
            <button
              onClick={handleRestore}
              disabled={isPending}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-green-300 bg-white px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-50 transition-colors disabled:opacity-60"
            >
              <ArrowPathIcon className="h-3.5 w-3.5" />
              {tR("button")}
            </button>
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
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors disabled:opacity-60"
          >
            <TrashIcon className="h-3.5 w-3.5" />
            {tD("button")}
          </button>
        </div>
      </div>

    </div>
  );
}
