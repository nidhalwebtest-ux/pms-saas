"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import type { ImportRecordType } from "@prisma/client";
import { Button, Alert, useConfirmDialog } from "@/components/ui";
import { ImportProgress } from "./ImportProgress";

interface JobStatus {
  status: string;
  totalRows: number;
  processedRows: number;
  successRows: number;
  errorRows: number;
  startedAt: string | null;
  finishedAt: string | null;
}

const RECORD_LIST_HREF: Record<ImportRecordType, string> = {
  BUILDINGS: "/dashboard/properties",
  UNITS: "/dashboard/units",
  TENANTS: "/dashboard/tenants",
  RESERVATIONS: "/dashboard/reservations",
  EXPENSES: "/dashboard/expenses",
};

export function Step5Run({
  jobId, recordType, onStartAnother, onReimport,
}: {
  jobId: string;
  recordType: ImportRecordType;
  onStartAnother: () => void;
  onReimport: (newJobId: string) => void;
}) {
  const t5 = useTranslations("dataImport.step5");
  const tResult = useTranslations("dataImport.result");
  const tTypes = useTranslations("dataImport.recordTypes");
  const confirm = useConfirmDialog();

  const [job, setJob] = useState<JobStatus | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reimporting, setReimporting] = useState(false);
  const runningRef = useRef(true);
  const startTimeRef = useRef<number>(Date.now());
  const [elapsed, setElapsed] = useState(0);

  const processBatch = useCallback(async () => {
    const res = await fetch(`/api/import-jobs/${jobId}/process-batch`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      runningRef.current = false;
      return;
    }
    if (data.done) {
      runningRef.current = false;
      const statusRes = await fetch(`/api/import-jobs/${jobId}`);
      setJob(await statusRes.json());
      return;
    }
    setJob((prev) => prev ? { ...prev, ...data } : { ...data, status: "RUNNING" });
    if (runningRef.current) {
      setTimeout(processBatch, 300);
    }
  }, [jobId]);

  useEffect(() => {
    runningRef.current = true;
    processBatch();
    return () => { runningRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  async function handleCancel() {
    const { confirmed } = await confirm({
      title: t5("cancelConfirmTitle"),
      description: t5("cancelConfirmBody"),
      tone: "warning",
      confirmLabel: t5("cancelConfirmAction"),
    });
    if (!confirmed) return;

    setCancelling(true);
    runningRef.current = false;
    await fetch(`/api/import-jobs/${jobId}/cancel`, { method: "POST" });
    const statusRes = await fetch(`/api/import-jobs/${jobId}`);
    setJob(await statusRes.json());
    setCancelling(false);
  }

  async function handleReimport() {
    setReimporting(true);
    try {
      const res = await fetch(`/api/import-jobs/${jobId}/reimport`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.id) {
        toast.error("Couldn't start a re-import.");
        return;
      }
      onReimport(data.id);
    } finally {
      setReimporting(false);
    }
  }

  const isRunning = !job || job.status === "RUNNING";
  const isDone = job && ["COMPLETED", "COMPLETED_WITH_ERRORS", "CANCELLED"].includes(job.status);

  if (isRunning) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-fg">{t5("title")}</h2>
          <p className="mt-0.5 text-sm text-fg-secondary">{t5("subtitle")}</p>
        </div>

        <ImportProgress
          processed={job?.processedRows ?? 0}
          total={job?.totalRows ?? 0}
          success={job?.successRows ?? 0}
          error={job?.errorRows ?? 0}
          elapsedSeconds={elapsed}
        />

        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={handleCancel} disabled={cancelling}>
            {cancelling ? t5("cancelling") : t5("cancelRun")}
          </Button>
        </div>
      </div>
    );
  }

  // Result screen
  const duration = job?.startedAt && job?.finishedAt
    ? formatDuration((new Date(job.finishedAt).getTime() - new Date(job.startedAt).getTime()) / 1000)
    : formatDuration(elapsed);

  const title = job?.status === "CANCELLED"
    ? tResult("titleCancelled")
    : (job?.errorRows ?? 0) > 0
    ? tResult("titleWithErrors")
    : tResult("title");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-fg">{title}</h2>
        <p className="mt-1 text-sm text-fg-secondary">
          {tResult("summary", { success: job?.successRows ?? 0, total: job?.totalRows ?? 0, duration })}
        </p>
      </div>

      {job && job.errorRows > 0 && (
        <Alert
          variant="warning"
          description={`${job.errorRows} row(s) couldn't be imported.`}
        />
      )}

      <div className="flex flex-wrap gap-2.5">
        {job && job.errorRows > 0 && (
          <>
            <a href={`/api/import-jobs/${jobId}/errors-file`}>
              <Button variant="secondary">
                <ArrowDownTrayIcon className="h-4 w-4" />
                {tResult("downloadFailedRows")}
              </Button>
            </a>
            <Button variant="primary" onClick={handleReimport} disabled={reimporting} loading={reimporting}>
              {tResult("reimport")}
            </Button>
          </>
        )}
        <Link href={RECORD_LIST_HREF[recordType]}>
          <Button variant="secondary">
            {tResult("viewRecords", { recordType: tTypes(recordType) })}
          </Button>
        </Link>
        <Button variant="secondary" onClick={onStartAnother}>
          {tResult("startAnother")}
        </Button>
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}
