"use client";

import { useTranslations } from "next-intl";
import { type ScoreFactor, type ScoreValue } from "@/utils/crm-scoring";

const SCORE_VALUES: ScoreValue[] = [1, 3, 5];

/**
 * 1/3/5 score selector for a single qualification factor, labeled with the
 * playbook's meaning for each level (from i18n `admin.scoring.factors.*`).
 * Shared by the prospect form and the detail-page scoring editor.
 */
export function ScoreSelector({
  factor,
  value,
  onChange,
}: {
  factor: ScoreFactor;
  value: ScoreValue;
  onChange: (v: ScoreValue) => void;
}) {
  const t = useTranslations("admin.scoring.factors");
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-fg">{t(`${factor}.title`)}</span>
        <span className="text-xs text-fg-tertiary">{value}/5</span>
      </div>
      <p className="mt-0.5 text-xs text-fg-tertiary">{t(`${factor}.help`)}</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {SCORE_VALUES.map((v) => {
          const active = value === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              aria-pressed={active}
              className={`flex flex-col items-start gap-0.5 rounded-lg border p-2.5 text-start transition-colors ${
                active
                  ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
                  : "border-border-default bg-surface hover:border-brand-300 hover:bg-subtle"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                    active ? "bg-brand-500 text-white" : "bg-subtle text-fg-secondary"
                  }`}
                >
                  {v}
                </span>
                <span className={`text-xs font-semibold ${active ? "text-brand-700" : "text-fg"}`}>
                  {t(`${factor}.l${v}Label`)}
                </span>
              </span>
              <span className="text-[11px] leading-tight text-fg-tertiary">{t(`${factor}.l${v}Desc`)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
