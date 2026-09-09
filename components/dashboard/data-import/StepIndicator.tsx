"use client";

import { CheckIcon } from "@heroicons/react/24/outline";

export const WIZARD_STEPS = ["choose", "upload", "map", "validate", "run"] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

export function StepIndicator({ current, labels }: { current: WizardStep; labels: Record<WizardStep, string> }) {
  const currentIdx = WIZARD_STEPS.indexOf(current);

  return (
    <ol className="flex items-center gap-0 overflow-x-auto pb-1" aria-label="Import steps">
      {WIZARD_STEPS.map((step, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx;

        return (
          <li key={step} className="flex items-center flex-shrink-0">
            {idx > 0 && (
              <div className={`h-px w-8 sm:w-14 transition-colors duration-300 ${
                done ? "bg-brand-500" : "bg-border-subtle"
              }`} />
            )}
            <div className="flex items-center gap-2 px-1">
              <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all duration-300 ${
                done
                  ? "border-brand-500 bg-brand-500 text-white"
                  : active
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-border-default bg-surface text-fg-tertiary"
              }`}>
                {done ? <CheckIcon className="h-4 w-4" /> : idx + 1}
              </div>
              <span className={`hidden sm:inline text-[13px] font-medium whitespace-nowrap ${
                active ? "text-fg" : done ? "text-fg-secondary" : "text-fg-tertiary"
              }`}>
                {labels[step]}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
