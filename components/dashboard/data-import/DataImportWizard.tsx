"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ImportRecordType } from "@prisma/client";
import { StepIndicator, WIZARD_STEPS, type WizardStep } from "./StepIndicator";
import { Step1Choose } from "./Step1Choose";
import { Step2Upload, type UploadResult } from "./Step2Upload";
import { Step3Mapping } from "./Step3Mapping";
import { Step4Validate } from "./Step4Validate";
import { Step5Run } from "./Step5Run";
import type { FieldMapping, ImportOptions } from "@/lib/import/types";
import { DEFAULT_IMPORT_OPTIONS } from "@/lib/import/types";

export type RecordCounts = Record<ImportRecordType, number>;

export interface WizardState {
  jobId: string | null;
  recordType: ImportRecordType | null;
  upload: UploadResult | null;
  mapping: FieldMapping;
  options: ImportOptions;
}

export function DataImportWizard({ counts }: { counts: RecordCounts }) {
  const t = useTranslations("dataImport");
  const [step, setStep] = useState<WizardStep>("choose");
  const [state, setState] = useState<WizardState>({
    jobId: null,
    recordType: null,
    upload: null,
    mapping: {},
    options: DEFAULT_IMPORT_OPTIONS,
  });

  const stepLabels: Record<WizardStep, string> = {
    choose: t("steps.choose"),
    upload: t("steps.upload"),
    map: t("steps.map"),
    validate: t("steps.validate"),
    run: t("steps.run"),
  };

  function goTo(next: WizardStep) {
    setStep(next);
  }

  function reset() {
    setState({ jobId: null, recordType: null, upload: null, mapping: {}, options: DEFAULT_IMPORT_OPTIONS });
    setStep("choose");
  }

  // Re-import jumps straight into the new job's upload step (same record
  // type, fresh job id) instead of resetting to "choose" — reimport always
  // requires uploading a fixed file, so this is the equivalent of starting
  // step 2 directly rather than losing the new job entirely.
  function goToReimport(newJobId: string) {
    setState((s) => ({ ...s, jobId: newJobId, upload: null, mapping: {}, options: DEFAULT_IMPORT_OPTIONS }));
    setStep("upload");
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fg">{t("title")}</h1>
        <p className="mt-0.5 text-sm text-fg-secondary">{t("subtitle")}</p>
      </div>

      <div className="rounded-xl border border-border-subtle bg-surface p-4 sm:p-5">
        <StepIndicator current={step} labels={stepLabels} />
      </div>

      <div className="rounded-xl border border-border-subtle bg-surface p-5 sm:p-6">
        {step === "choose" && (
          <Step1Choose
            counts={counts}
            onSelect={(recordType, jobId) => {
              setState((s) => ({ ...s, recordType, jobId }));
              goTo("upload");
            }}
          />
        )}

        {step === "upload" && state.recordType && state.jobId && (
          <Step2Upload
            jobId={state.jobId}
            recordType={state.recordType}
            onBack={() => goTo("choose")}
            onUploaded={(upload) => {
              setState((s) => ({ ...s, upload, mapping: upload.mapping }));
              goTo("map");
            }}
          />
        )}

        {step === "map" && state.recordType && state.jobId && state.upload && (
          <Step3Mapping
            jobId={state.jobId}
            recordType={state.recordType}
            upload={state.upload}
            initialMapping={state.mapping}
            initialOptions={state.options}
            onBack={() => goTo("upload")}
            onConfirmed={(mapping, options) => {
              setState((s) => ({ ...s, mapping, options }));
              goTo("validate");
            }}
          />
        )}

        {step === "validate" && state.jobId && state.recordType && (
          <Step4Validate
            jobId={state.jobId}
            recordType={state.recordType}
            onBack={() => goTo("map")}
            onRun={() => goTo("run")}
          />
        )}

        {step === "run" && state.jobId && state.recordType && (
          <Step5Run
            jobId={state.jobId}
            recordType={state.recordType}
            onStartAnother={reset}
            onReimport={goToReimport}
          />
        )}
      </div>
    </div>
  );
}
