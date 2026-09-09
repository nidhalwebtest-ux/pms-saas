"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import type { ImportRecordType } from "@prisma/client";
import { Button, Alert, Spinner, SegmentedControl } from "@/components/ui";

interface ErrorRow {
  id: string;
  rowNumber: number;
  rawData: Record<string, string>;
  status: string;
  errorMessage: string | null;
}

export function Step4Validate({
  jobId, recordType: _recordType, onBack, onRun,
}: {
  jobId: string;
  recordType: ImportRecordType;
  onBack: () => void;
  onRun: () => void;
}) {
  const t4 = useTranslations("dataImport.step4");
  const tCommon = useTranslations("dataImport");
  const [validating, setValidating] = useState(true);
  const [summary, setSummary] = useState<{ totalRows: number; validRows: number; errorRows: number } | null>(null);
  const [errorRows, setErrorRows] = useState<ErrorRow[]>([]);
  const [filter, setFilter] = useState<"all" | string>("all");
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const runValidation = useCallback(async () => {
    setValidating(true);
    setError(null);
    try {
      const res = await fetch(`/api/import-jobs/${jobId}/validate`, { method: "POST" });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setSummary(data);

      if (data.errorRows > 0) {
        const rowsRes = await fetch(`/api/import-jobs/${jobId}/rows?status=ERROR&pageSize=200`);
        const rowsData = await rowsRes.json();
        setErrorRows(rowsData.rows);
      } else {
        setErrorRows([]);
      }
    } catch {
      setError("Validation failed. Please try again.");
    } finally {
      setValidating(false);
    }
  }, [jobId]);

  useEffect(() => {
    runValidation();
  }, [runValidation]);

  async function handleStart() {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(`/api/import-jobs/${jobId}/run`, { method: "POST" });
      if (!res.ok) throw new Error("failed");
      onRun();
    } catch {
      setError("Couldn't start the import. Please try again.");
      setStarting(false);
    }
  }

  const errorFields = Array.from(new Set(errorRows.map((r) => r.errorMessage?.split(":")[0]?.trim() ?? "").filter(Boolean)));
  const filteredRows = filter === "all" ? errorRows : errorRows.filter((r) => r.errorMessage?.startsWith(filter));

  if (validating) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <Spinner size={32} />
        <p className="text-sm text-fg-secondary">{t4("validating")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-fg">{t4("title")}</h2>
        <p className="mt-0.5 text-sm text-fg-secondary">{t4("subtitle")}</p>
      </div>

      {error && <Alert variant="error" description={error} />}

      {summary && (
        <Alert
          variant={summary.errorRows === 0 ? "success" : "warning"}
          title={summary.errorRows === 0
            ? t4("allReady", { count: summary.totalRows })
            : t4("readySummary", { valid: summary.validRows, errors: summary.errorRows })}
        />
      )}

      {errorRows.length > 0 && (
        <div className="space-y-3">
          {errorFields.length > 1 && (
            <SegmentedControl
              size="sm"
              ariaLabel={t4("errorsTable.filterAll")}
              value={filter}
              onValueChange={setFilter}
              options={[
                { value: "all", label: t4("errorsTable.filterAll") },
                ...errorFields.map((f) => ({ value: f, label: f })),
              ]}
            />
          )}

          <div className="overflow-x-auto rounded-lg border border-border-subtle max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-subtle sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-start font-medium text-fg-secondary w-16">{t4("errorsTable.row")}</th>
                  <th className="px-3 py-2 text-start font-medium text-fg-secondary">{t4("errorsTable.problem")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filteredRows.map((row) => (
                  <tr key={row.id} className="bg-error-50/40">
                    <td className="px-3 py-2 tabular-nums ltr-numbers text-fg-secondary">{row.rowNumber}</td>
                    <td className="px-3 py-2 text-error-700">{row.errorMessage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <a
            href={`/api/import-jobs/${jobId}/errors-file`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            {t4("downloadErrors")}
          </a>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="secondary" onClick={onBack} disabled={starting}>
          {tCommon("back")}
        </Button>
        {summary && summary.validRows > 0 && (
          <Button variant="primary" onClick={handleStart} disabled={starting}>
            {starting ? <Spinner size={14} /> : summary.errorRows > 0
              ? t4("proceedValid", { count: summary.validRows })
              : t4("proceedAll")}
          </Button>
        )}
      </div>
    </div>
  );
}
