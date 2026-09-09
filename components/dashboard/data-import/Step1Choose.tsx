"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  BuildingOffice2Icon, HomeModernIcon, UserGroupIcon,
  CalendarDaysIcon, ReceiptPercentIcon, ArrowDownTrayIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import type { ImportRecordType } from "@prisma/client";
import { Button, Alert, Spinner } from "@/components/ui";
import { IMPORT_ADAPTERS } from "@/lib/import/registry";
import type { RecordCounts } from "./DataImportWizard";

const RECORD_ICONS: Record<ImportRecordType, React.ElementType> = {
  BUILDINGS: BuildingOffice2Icon,
  UNITS: HomeModernIcon,
  TENANTS: UserGroupIcon,
  RESERVATIONS: CalendarDaysIcon,
  EXPENSES: ReceiptPercentIcon,
};

export function Step1Choose({
  counts, onSelect,
}: {
  counts: RecordCounts;
  onSelect: (recordType: ImportRecordType, jobId: string) => void;
}) {
  const t = useTranslations("dataImport");
  const t1 = useTranslations("dataImport.step1");
  const tTypes = useTranslations("dataImport.recordTypes");
  const tDesc = useTranslations("dataImport.recordTypeDescriptions");
  const locale = useLocale();
  const [creating, setCreating] = useState<ImportRecordType | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(recordType: ImportRecordType) {
    setCreating(recordType);
    setError(null);
    try {
      const res = await fetch("/api/import-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordType }),
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      onSelect(recordType, data.id);
    } catch {
      setError("Couldn't start a new import. Please try again.");
      setCreating(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-fg">{t1("title")}</h2>
        <p className="mt-0.5 text-sm text-fg-secondary">{t1("subtitle")}</p>
      </div>

      {error && <Alert variant="error" description={error} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {IMPORT_ADAPTERS.map((adapter) => {
          const recordType = adapter.recordType;
          const Icon = RECORD_ICONS[recordType];
          const count = counts[recordType];
          const blockedBy = adapter.dependsOn.filter((dep) => counts[dep] === 0);
          const isBlocked = blockedBy.length > 0;
          const isCreating = creating === recordType;

          return (
            <div
              key={recordType}
              className={`relative flex flex-col rounded-xl border p-4 transition-colors ${
                isBlocked ? "border-border-subtle bg-subtle/40" : "border-border-default hover:border-brand-300 hover:bg-brand-50/30"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${
                  isBlocked ? "bg-subtle text-fg-tertiary" : "bg-brand-50 text-brand-600"
                }`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-fg">{tTypes(recordType)}</h3>
                  <p className="mt-0.5 text-xs text-fg-secondary">{tDesc(recordType)}</p>
                  <p className="mt-1.5 text-xs font-medium text-fg-tertiary tabular-nums ltr-numbers">
                    {t1("currentCount", { count })}
                  </p>
                </div>
              </div>

              {isBlocked && (
                <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-warning-50 px-2.5 py-2 text-xs text-warning-800">
                  <ExclamationTriangleIcon className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                  <span>
                    {t1("dependencyWarning", {
                      dependency: blockedBy.map((d) => tTypes(d)).join(", "),
                      recordType: tTypes(recordType),
                    })}
                  </span>
                </div>
              )}

              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="flex gap-2">
                  <a
                    href={`/api/import-jobs/template?recordType=${recordType}&lang=en`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800"
                  >
                    <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                    {t1("templateEn")}
                  </a>
                  <span className="text-fg-tertiary text-xs">·</span>
                  <a
                    href={`/api/import-jobs/template?recordType=${recordType}&lang=ar`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800"
                  >
                    {t1("templateAr")}
                  </a>
                </div>
                <Button
                  variant={isBlocked ? "secondary" : "primary"}
                  size="sm"
                  disabled={isCreating}
                  onClick={() => handleSelect(recordType)}
                >
                  {isCreating ? <Spinner size={14} /> : t1("select")}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
