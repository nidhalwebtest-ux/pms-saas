"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ImportRecordType } from "@prisma/client";
import { Button, Alert, FileUpload, Spinner } from "@/components/ui";
import type { DetectedEncoding } from "@/lib/import/encoding";
import type { FieldMapping } from "@/lib/import/types";

export interface UploadResult {
  headers: string[];
  previewRows: Record<string, string>[];
  rowCount: number;
  encoding: DetectedEncoding | "n/a (xlsx)";
  format: "csv" | "xlsx";
  mapping: FieldMapping;
  matchedFields: string[];
  unmatchedColumns: string[];
  hasFormulaCells: boolean;
}

const ENCODING_OPTIONS: { value: DetectedEncoding; label: string }[] = [
  { value: "utf-8", label: "UTF-8" },
  { value: "utf-8-bom", label: "UTF-8 (with BOM)" },
  { value: "windows-1256", label: "Windows-1256 (Arabic Windows)" },
];

export function Step2Upload({
  jobId, recordType, onBack, onUploaded,
}: {
  jobId: string;
  recordType: ImportRecordType;
  onBack: () => void;
  onUploaded: (result: UploadResult) => void;
}) {
  const t2 = useTranslations("dataImport.step2");
  const tCommon = useTranslations("dataImport");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [encodingOverride, setEncodingOverride] = useState<DetectedEncoding | "">("");

  async function doUpload(selectedFile: File, encoding?: DetectedEncoding) {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (encoding) formData.append("encoding", encoding);

      const res = await fetch(`/api/import-jobs/${jobId}/upload`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        const key = data.error as string;
        setError(t2(`errors.${key}` as never, data.detail ?? {}) || key);
        setUploading(false);
        return;
      }
      onUploaded(data as UploadResult);
    } catch {
      setError(t2("errors.PARSE_FAILED", { message: "network error" }));
      setUploading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-fg">{t2("title")}</h2>
        <p className="mt-0.5 text-sm text-fg-secondary">{t2("subtitle")}</p>
      </div>

      {error && (
        <Alert
          variant="error"
          description={error}
          actions={
            <div className="flex flex-col gap-2">
              <p className="text-xs text-fg-secondary">{t2("encodingOverride")}</p>
              <div className="flex flex-wrap gap-1.5">
                {ENCODING_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    variant="secondary"
                    size="sm"
                    disabled={uploading}
                    onClick={() => {
                      if (file) doUpload(file, opt.value);
                    }}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          }
        />
      )}

      {uploading ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-default py-16">
          <Spinner size={28} />
          <p className="text-sm text-fg-secondary">{t2("uploading")}</p>
        </div>
      ) : (
        <FileUpload
          label={t2("dropHint")}
          layout="zone"
          accept={{
            "text/csv": [".csv"],
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
            "text/plain": [".txt"],
          }}
          maxSize={5 * 1024 * 1024}
          maxFiles={1}
          hint={t2("formatHint")}
          value={file ? [file] : []}
          onChange={(files) => {
            const f = files[0] ?? null;
            setFile(f);
            setEncodingOverride("");
            if (f) doUpload(f);
          }}
        />
      )}

      <div className="flex justify-between pt-2">
        <Button variant="secondary" onClick={onBack} disabled={uploading}>
          {tCommon("back")}
        </Button>
      </div>
    </div>
  );
}
