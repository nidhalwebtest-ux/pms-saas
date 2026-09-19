"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { format } from "date-fns";
import { ar as arLocale, enGB as enLocale } from "date-fns/locale";
import { ArrowDownTrayIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import type { ImportRecordType } from "@prisma/client";
import { Badge, Button, useConfirmDialog, type BadgeTone } from "@/components/ui";
import { toast } from "sonner";

interface JobRow {
  id: string;
  recordType: ImportRecordType;
  status: string;
  originalFilename: string;
  totalRows: number;
  processedRows: number;
  successRows: number;
  errorRows: number;
  errorFilePath: string | null;
  parentJobId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  createdByName: string | null;
}

const STATUS_TONE: Record<string, BadgeTone> = {
  PENDING: "neutral",
  VALIDATING: "info",
  READY: "info",
  RUNNING: "info",
  COMPLETED: "success",
  COMPLETED_WITH_ERRORS: "warning",
  FAILED: "danger",
  CANCELLED: "neutral",
};

const UNDOABLE_STATUSES = new Set(["COMPLETED", "COMPLETED_WITH_ERRORS", "CANCELLED"]);

/** Re-import always requires uploading a fixed file — this list view can't
 *  jump into the wizard's upload step the way Step5Run does, so it opens the
 *  wizard fresh with the new job id via a full navigation instead. */
function reimportHref(newJobId: string): string {
  return `/dashboard/settings/data-import?resumeJobId=${newJobId}`;
}

export function JobHistory({ onReimported }: { onReimported?: () => void }) {
  const t = useTranslations("dataImport.history");
  const tUndo = useTranslations("dataImport.undo");
  const tTypes = useTranslations("dataImport.recordTypes");
  const tStatus = useTranslations("dataImport.history.status");
  const locale = useLocale();
  const dfLocale = locale === "ar" ? arLocale : enLocale;
  const confirm = useConfirmDialog();

  const [jobs, setJobs] = useState<JobRow[] | null>(null);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [reimportingId, setReimportingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/import-jobs");
    if (!res.ok) return;
    const data = await res.json();
    setJobs(data.jobs ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleUndo(job: JobRow) {
    // Preview first so the confirmation shows the real count, not a guess.
    const previewRes = await fetch(`/api/import-jobs/${job.id}/undo`);
    const preview = await previewRes.json().catch(() => ({ eligibleCount: 0 }));
    if (!previewRes.ok || preview.eligibleCount === 0) {
      toast.error(tUndo("noneEligible"));
      return;
    }

    const { confirmed } = await confirm({
      title: tUndo("confirmTitle"),
      description: tUndo("confirmBody", { count: preview.eligibleCount }),
      tone: "destructive",
      confirmLabel: tUndo("confirmAction", { count: preview.eligibleCount }),
    });
    if (!confirmed) return;

    setUndoingId(job.id);
    try {
      const res = await fetch(`/api/import-jobs/${job.id}/undo`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(tUndo("noneEligible"));
        return;
      }
      if (data.blocked > 0) {
        toast.error(tUndo("blockedBody", { blocked: data.blocked, total: data.deleted + data.blocked, deleted: data.deleted }));
      } else {
        toast.success(tUndo("successToast", { count: data.deleted }));
      }
      await load();
    } finally {
      setUndoingId(null);
    }
  }

  async function handleReimport(job: JobRow) {
    setReimportingId(job.id);
    try {
      const res = await fetch(`/api/import-jobs/${job.id}/reimport`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.id) {
        toast.error("Couldn't start a re-import.");
        return;
      }
      window.location.href = reimportHref(data.id);
    } finally {
      setReimportingId(null);
    }
  }

  if (jobs === null) return null;
  if (jobs.length === 0) {
    return (
      <div className="rounded-xl border border-border-subtle bg-surface p-6 text-center text-sm text-fg-tertiary">
        {t("empty")}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-surface overflow-hidden">
      <div className="border-b border-border-subtle px-5 py-4">
        <h2 className="text-sm font-semibold text-fg">{t("title")}</h2>
        <p className="mt-0.5 text-xs text-fg-tertiary">{t("subtitle")}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-subtle">
            <tr>
              <th className="px-4 py-2.5 text-start text-xs font-semibold uppercase tracking-wide text-fg-tertiary">{t("columns.date")}</th>
              <th className="px-4 py-2.5 text-start text-xs font-semibold uppercase tracking-wide text-fg-tertiary">{t("columns.recordType")}</th>
              <th className="px-4 py-2.5 text-start text-xs font-semibold uppercase tracking-wide text-fg-tertiary">{t("columns.file")}</th>
              <th className="px-4 py-2.5 text-end text-xs font-semibold uppercase tracking-wide text-fg-tertiary">{t("columns.counts")}</th>
              <th className="px-4 py-2.5 text-start text-xs font-semibold uppercase tracking-wide text-fg-tertiary">{t("columns.status")}</th>
              <th className="px-4 py-2.5 text-end text-xs font-semibold uppercase tracking-wide text-fg-tertiary">{t("columns.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {jobs.map((job) => {
              const canUndo = UNDOABLE_STATUSES.has(job.status) && job.successRows > 0;
              const canReimport = job.errorRows > 0;
              return (
                <tr key={job.id}>
                  <td className="px-4 py-3 text-fg-secondary ltr-numbers whitespace-nowrap">
                    {format(new Date(job.createdAt), "d MMM yyyy, HH:mm", { locale: dfLocale })}
                  </td>
                  <td className="px-4 py-3 text-fg">{tTypes(job.recordType)}</td>
                  <td className="px-4 py-3 text-fg-secondary max-w-[200px] truncate" title={job.originalFilename}>
                    {job.originalFilename || "—"}
                  </td>
                  <td className="px-4 py-3 text-end ltr-numbers">
                    <span className="text-success-600 font-medium">{job.successRows}</span>
                    {job.errorRows > 0 && <span className="text-error-600"> / {job.errorRows}</span>}
                    <span className="text-fg-tertiary"> / {job.totalRows}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[job.status] ?? "neutral"} appearance="subtle" size="sm">
                      {tStatus(job.status as never)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5 flex-wrap">
                      {job.errorFilePath && (
                        <a href={`/api/import-jobs/${job.id}/errors-file`}>
                          <Button variant="secondary" size="sm">
                            <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                            {t("downloadErrors")}
                          </Button>
                        </a>
                      )}
                      {canReimport && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleReimport(job)}
                          disabled={reimportingId === job.id}
                          loading={reimportingId === job.id}
                        >
                          <ArrowPathIcon className="h-3.5 w-3.5" />
                          {t("reimport")}
                        </Button>
                      )}
                      {canUndo ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleUndo(job)}
                          disabled={undoingId === job.id}
                          loading={undoingId === job.id}
                        >
                          {t("undo")}
                        </Button>
                      ) : (
                        job.successRows > 0 && (
                          <span className="text-xs text-fg-tertiary self-center">{t("undoNotAvailable")}</span>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
