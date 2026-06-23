"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PencilSquareIcon } from "@heroicons/react/24/outline";
import { Badge, Button } from "@/components/ui";
import {
  SCORE_FACTORS,
  computeScoring,
  type ScoreValue,
} from "@/utils/crm-scoring";
import { ScoreSelector } from "../../_lib/ScoreSelector";
import { tierBadge, tierLabel } from "../../_lib/crm-options";
import { updateScores } from "../actions";
import type { ProspectDetailData } from "./page";

export default function ScoringCard({ prospect }: { prospect: ProspectDetailData }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [scores, setScores] = useState<Record<(typeof SCORE_FACTORS)[number], ScoreValue>>({
    scoreSize: prospect.scoreSize as ScoreValue,
    scoreKhareefActivity: prospect.scoreKhareefActivity as ScoreValue,
    scorePainSignals: prospect.scorePainSignals as ScoreValue,
    scoreDigitalComfort: prospect.scoreDigitalComfort as ScoreValue,
    scoreReachability: prospect.scoreReachability as ScoreValue,
  });

  const live = useMemo(() => computeScoring(scores), [scores]);

  const save = () => {
    const fd = new FormData();
    SCORE_FACTORS.forEach((f) => fd.set(f, String(scores[f])));
    startTransition(async () => {
      const res = await updateScores(prospect.id, fd);
      if ("error" in res) { toast.error(res.error); return; }
      toast.success(t("scoring.updated"));
      setEditing(false);
      router.refresh();
    });
  };

  const cancel = () => {
    setScores({
      scoreSize: prospect.scoreSize as ScoreValue,
      scoreKhareefActivity: prospect.scoreKhareefActivity as ScoreValue,
      scorePainSignals: prospect.scorePainSignals as ScoreValue,
      scoreDigitalComfort: prospect.scoreDigitalComfort as ScoreValue,
      scoreReachability: prospect.scoreReachability as ScoreValue,
    });
    setEditing(false);
  };

  return (
    <div className="rounded-2xl border border-border-default bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-fg">{t("scoring.title")}</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tabular-nums text-fg">
            {editing ? live.scoreTotal : prospect.scoreTotal}
          </span>
          <span className="text-xs text-fg-tertiary">/ 25</span>
          <Badge {...tierBadge(editing ? live.tier : prospect.tier)} size="sm">
            {tierLabel(editing ? live.tier : prospect.tier)}
          </Badge>
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-tertiary hover:bg-subtle hover:text-fg"
              title={t("scoring.edit")}
            >
              <PencilSquareIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {SCORE_FACTORS.map((f) => (
              <ScoreSelector
                key={f}
                factor={f}
                value={scores[f]}
                onChange={(val) => setScores((prev) => ({ ...prev, [f]: val }))}
              />
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={cancel} disabled={pending}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" size="sm" onClick={save} loading={pending}>
              {t("scoring.save")}
            </Button>
          </div>
        </div>
      ) : (
        <dl className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {SCORE_FACTORS.map((f) => (
            <div key={f} className="flex items-center justify-between gap-2 rounded-md bg-subtle/60 px-2.5 py-1.5">
              <dt className="text-xs text-fg-secondary">{t(`scoring.factors.${f}.title`)}</dt>
              <dd className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-fg">
                  {t(`scoring.factors.${f}.l${prospect[f]}Label`)}
                </span>
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
                  {prospect[f]}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
