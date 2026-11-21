"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckIcon, XCircleIcon, ArrowUturnLeftIcon } from "@heroicons/react/24/outline";
import { Badge, useConfirmDialog } from "@/components/ui";
import { FUNNEL_STAGES } from "../../_lib/crm-options";
import { updateStage } from "../actions";

const LOST_REASON_VALUES = ["price", "no_need", "competitor", "unresponsive", "not_now", "other"] as const;

export default function StageControl({
  prospectId,
  stage,
  lostReason,
}: {
  prospectId: string;
  stage: string;
  lostReason: string | null;
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const confirm = useConfirmDialog();
  const [pending, startTransition] = useTransition();

  const lostReasons = LOST_REASON_VALUES.map((value) => ({
    value,
    label: t(`stage.lostReasons.${value}`),
  }));

  const currentIdx = FUNNEL_STAGES.indexOf(stage as (typeof FUNNEL_STAGES)[number]);
  const isLost = stage === "LOST";

  const move = (next: string, reason?: string | null) => {
    startTransition(async () => {
      const res = await updateStage(prospectId, next, reason ?? null);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(t("stage.movedTo", { stage: t(`enums.stage.${next}`) }));
      router.refresh();
    });
  };

  const markLost = async () => {
    const { confirmed, reason, notes } = await confirm({
      title: t("stage.lostDialog.title"),
      description: t("stage.lostDialog.desc"),
      confirmLabel: t("stage.lostDialog.confirm"),
      tone: "destructive",
      reason: {
        options: lostReasons,
        label: t("stage.lostDialog.label"),
        notesFor: ["other"],
        notesLabel: t("stage.lostDialog.detailsLabel"),
        notesPlaceholder: t("stage.lostDialog.detailsPh"),
      },
    });
    if (!confirmed) return;
    const label = lostReasons.find((r) => r.value === reason)?.label ?? reason ?? "";
    const text = [label, notes].filter(Boolean).join(" — ");
    move("LOST", text || null);
  };

  return (
    <div className="rounded-2xl border border-border-default bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-tertiary">{t("stage.title")}</h3>
        {isLost ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => move("NOT_CONTACTED")}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
          >
            <ArrowUturnLeftIcon className="h-3.5 w-3.5" /> {t("stage.reopen")}
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={markLost}
            className="inline-flex items-center gap-1 text-xs font-medium text-error-600 hover:text-error-700 disabled:opacity-50"
          >
            <XCircleIcon className="h-3.5 w-3.5" /> {t("stage.markLost")}
          </button>
        )}
      </div>

      {isLost ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral" appearance="subtle" strikethrough>
            {t("stage.lost")}
          </Badge>
          {lostReason && <span className="text-sm text-fg-secondary">{lostReason}</span>}
        </div>
      ) : (
        <ol className="flex flex-wrap gap-1.5">
          {FUNNEL_STAGES.map((s, i) => {
            const done = i < currentIdx;
            const active = i === currentIdx;
            return (
              <li key={s}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => move(s)}
                  aria-current={active ? "step" : undefined}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
                    active
                      ? "bg-brand-500 text-white"
                      : done
                        ? "bg-success-50 text-success-700 hover:bg-success-100"
                        : "bg-subtle text-fg-secondary hover:bg-border-subtle"
                  }`}
                >
                  {done && <CheckIcon className="h-3.5 w-3.5" />}
                  {t(`enums.stage.${s}`)}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
