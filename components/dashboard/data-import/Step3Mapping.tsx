"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import type { ImportRecordType } from "@prisma/client";
import { Button, Alert, Select, RadioGroup, Radio, Badge } from "@/components/ui";
import { getAdapter } from "@/lib/import/registry";
import type { FieldMapping, ImportOptions } from "@/lib/import/types";
import type { UploadResult } from "./Step2Upload";

export function Step3Mapping({
  jobId, recordType, upload, initialMapping, initialOptions, onBack, onConfirmed,
}: {
  jobId: string;
  recordType: ImportRecordType;
  upload: UploadResult;
  initialMapping: FieldMapping;
  initialOptions: ImportOptions;
  onBack: () => void;
  onConfirmed: (mapping: FieldMapping, options: ImportOptions) => void;
}) {
  const t3 = useTranslations("dataImport.step3");
  const tCommon = useTranslations("dataImport");
  const tFields = useTranslations(`dataImport.fields.${recordTypeToKey(recordType)}` as never);
  const adapter = getAdapter(recordType);

  const [mapping, setMapping] = useState<FieldMapping>(initialMapping);
  const [options, setOptions] = useState<ImportOptions>(initialOptions);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usedColumns = useMemo(
    () => new Set(Object.values(mapping).filter((v): v is string => !!v)),
    [mapping],
  );

  const previewRows = useMemo(() => {
    return upload.previewRows.slice(0, 3).map((raw) => {
      const parsed = adapter.parseRow(raw, mapping, options);
      return parsed;
    });
  }, [upload.previewRows, mapping, adapter, options]);

  const missingRequired = adapter.fields.filter((f) => f.required && !mapping[f.key]);

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/import-jobs/${jobId}/mapping`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapping, options }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.error === "missing_required_fields") {
          setError(null); // inline field markers already show this
        } else {
          setError("Couldn't save the mapping. Please try again.");
        }
        setSaving(false);
        return;
      }
      onConfirmed(mapping, options);
    } catch {
      setError("Couldn't save the mapping. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-fg">{t3("title")}</h2>
        <p className="mt-0.5 text-sm text-fg-secondary">{t3("subtitle")}</p>
      </div>

      {error && <Alert variant="error" description={error} />}

      {/* Field mapping table */}
      <div className="overflow-hidden rounded-lg border border-border-subtle">
        <table className="w-full text-sm">
          <thead className="bg-subtle">
            <tr>
              <th className="px-3 py-2 text-start font-medium text-fg-secondary">{t3("systemField")}</th>
              <th className="px-3 py-2 text-start font-medium text-fg-secondary">{t3("yourColumn")}</th>
              <th className="px-3 py-2 text-start font-medium text-fg-secondary w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {adapter.fields.map((field) => {
              const mappedColumn = mapping[field.key];
              const isMatched = upload.matchedFields.includes(field.key) && mappedColumn;
              const isMissing = field.required && !mappedColumn;

              return (
                <tr key={field.key}>
                  <td className="px-3 py-2.5">
                    <span className="font-medium text-fg">{tFields(field.key as never)}</span>
                    {field.required && <span className="ms-1 text-error-500">*</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <Select
                      label={tFields(field.key as never)}
                      value={mappedColumn ?? ""}
                      onChange={(e) => {
                        const val = e.target.value || null;
                        setMapping((m) => ({ ...m, [field.key]: val }));
                      }}
                      options={[
                        { value: "", label: t3("selectColumn") },
                        ...upload.headers.map((h) => ({ value: h, label: h })),
                      ]}
                      error={isMissing}
                      reserveMessageSpace={false}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    {isMatched && (
                      <Badge tone="success" size="sm" icon={<CheckCircleIcon />}>
                        {t3("matched")}
                      </Badge>
                    )}
                    {isMissing && (
                      <Badge tone="danger" size="sm" icon={<ExclamationTriangleIcon />}>
                        {t3("needsAttention")}
                      </Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {upload.unmatchedColumns.length > 0 && (
        <div className="rounded-lg bg-subtle px-3 py-2.5">
          <p className="text-xs font-medium text-fg-secondary">{t3("unmappedColumns")}</p>
          <p className="mt-0.5 text-xs text-fg-tertiary">{t3("unmappedColumnsHint")}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {upload.unmatchedColumns.filter((c) => !usedColumns.has(c)).map((c) => (
              <Badge key={c} tone="neutral" size="sm">{c}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Live preview */}
      <div>
        <h3 className="text-sm font-semibold text-fg mb-2">{t3("livePreview")}</h3>
        <div className="overflow-x-auto rounded-lg border border-border-subtle">
          <table className="w-full text-sm">
            <thead className="bg-subtle">
              <tr>
                {adapter.fields.filter((f) => mapping[f.key]).map((f) => (
                  <th key={f.key} className="px-3 py-2 text-start font-medium text-fg-secondary whitespace-nowrap">
                    {tFields(f.key as never)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {previewRows.map((parsed, i) => (
                <tr key={i} className={!parsed.ok ? "bg-error-50" : ""}>
                  {adapter.fields.filter((f) => mapping[f.key]).map((f) => (
                    <td key={f.key} className="px-3 py-2 whitespace-nowrap">
                      {parsed.ok ? (
                        <span className="text-fg">{String((parsed.data as Record<string, unknown>)[f.key] ?? "—")}</span>
                      ) : (
                        <span className="text-error-700 text-xs">
                          {parsed.errors.find((e) => e.field === f.key)?.message ?? ""}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 rounded-lg bg-subtle p-4">
        <RadioGroup
          label={t3("duplicateHandling")}
          helperText={t3("duplicateHandlingHint")}
          variant="cards"
        >
          <Radio
            name="duplicateHandling"
            value="skip"
            label={t3("duplicateSkip")}
            description={t3("duplicateSkipDesc")}
            checked={options.duplicateHandling === "skip"}
            onChange={() => setOptions((o) => ({ ...o, duplicateHandling: "skip" }))}
          />
          <Radio
            name="duplicateHandling"
            value="update"
            label={t3("duplicateUpdate")}
            description={t3("duplicateUpdateDesc")}
            checked={options.duplicateHandling === "update"}
            onChange={() => setOptions((o) => ({ ...o, duplicateHandling: "update" }))}
          />
          <Radio
            name="duplicateHandling"
            value="create"
            label={t3("duplicateCreate")}
            description={t3("duplicateCreateDesc")}
            checked={options.duplicateHandling === "create"}
            onChange={() => setOptions((o) => ({ ...o, duplicateHandling: "create" }))}
          />
        </RadioGroup>

        <RadioGroup
          label={t3("dateFormat")}
          helperText={t3("dateFormatHint")}
        >
          <Radio
            name="dateFormat"
            value="auto"
            label={t3("dateAuto")}
            checked={options.dateFormat === "auto"}
            onChange={() => setOptions((o) => ({ ...o, dateFormat: "auto" }))}
          />
          <Radio
            name="dateFormat"
            value="DMY"
            label={t3("dateDMY")}
            checked={options.dateFormat === "DMY"}
            onChange={() => setOptions((o) => ({ ...o, dateFormat: "DMY" }))}
          />
          <Radio
            name="dateFormat"
            value="MDY"
            label={t3("dateMDY")}
            checked={options.dateFormat === "MDY"}
            onChange={() => setOptions((o) => ({ ...o, dateFormat: "MDY" }))}
          />
        </RadioGroup>
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="secondary" onClick={onBack} disabled={saving}>
          {tCommon("back")}
        </Button>
        <Button variant="primary" onClick={handleConfirm} disabled={saving || missingRequired.length > 0}>
          {tCommon("next")}
        </Button>
      </div>
    </div>
  );
}

function recordTypeToKey(rt: ImportRecordType): string {
  return rt.toLowerCase();
}
