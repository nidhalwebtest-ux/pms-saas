"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, XCircleIcon, ArrowUturnLeftIcon } from "@heroicons/react/24/outline";
import { Badge, useConfirmDialog } from "@/components/ui";
import { FUNNEL_STAGES, STAGE_LABELS } from "../../_lib/crm-options";
import { updateStage } from "../actions";

const LOST_REASONS = [
  { value: "price", label: "Price / budget" },
  { value: "no_need", label: "No real need" },
  { value: "competitor", label: "Chose a competitor" },
  { value: "unresponsive", label: "Went unresponsive" },
  { value: "not_now", label: "Timing — not now" },
  { value: "other", label: "Other" },
];

export default function StageControl({
  prospectId,
  stage,
  lostReason,
}: {
  prospectId: string;
  stage: string;
  lostReason: string | null;
}) {
  const router = useRouter();
  const confirm = useConfirmDialog();
  const [pending, startTransition] = useTransition();

  const currentIdx = FUNNEL_STAGES.indexOf(stage as (typeof FUNNEL_STAGES)[number]);
  const isLost = stage === "LOST";

  const move = (next: string, reason?: string | null) => {
    startTransition(async () => {
      const res = await updateStage(prospectId, next, reason ?? null);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(`Stage → ${STAGE_LABELS[next] ?? next}`);
      router.refresh();
    });
  };

  const markLost = async () => {
    const { confirmed, reason, notes } = await confirm({
      title: "Mark prospect as lost?",
      description: "Capture why — it feeds the objection/lost-pattern view on the dashboard.",
      confirmLabel: "Mark lost",
      tone: "destructive",
      reason: {
        options: LOST_REASONS,
        label: "Lost reason",
        notesFor: ["other"],
        notesLabel: "Details",
        notesPlaceholder: "What happened?",
      },
    });
    if (!confirmed) return;
    const label = LOST_REASONS.find((r) => r.value === reason)?.label ?? reason ?? "";
    const text = [label, notes].filter(Boolean).join(" — ");
    move("LOST", text || null);
  };

  return (
    <div className="rounded-2xl border border-border-default bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-tertiary">Pipeline stage</h3>
        {isLost ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => move("NOT_CONTACTED")}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
          >
            <ArrowUturnLeftIcon className="h-3.5 w-3.5" /> Reopen
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={markLost}
            className="inline-flex items-center gap-1 text-xs font-medium text-error-600 hover:text-error-700 disabled:opacity-50"
          >
            <XCircleIcon className="h-3.5 w-3.5" /> Mark lost
          </button>
        )}
      </div>

      {isLost ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral" appearance="subtle" strikethrough>
            Lost
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
                  {STAGE_LABELS[s]}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
