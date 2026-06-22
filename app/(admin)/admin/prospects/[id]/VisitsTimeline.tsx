"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  PlusIcon,
  TrashIcon,
  MapPinIcon,
  HandRaisedIcon,
  ArrowRightCircleIcon,
} from "@heroicons/react/24/outline";
import { Badge, Button, useConfirmDialog } from "@/components/ui";
import { WHO_MET_LABELS } from "../../_lib/crm-options";
import { fmtDate } from "../../_lib/format";
import { deleteVisit } from "../actions";
import LogVisitModal from "./LogVisitModal";
import type { VisitDTO } from "./page";

export default function VisitsTimeline({
  prospectId,
  stage,
  visits,
}: {
  prospectId: string;
  stage: string;
  visits: VisitDTO[];
}) {
  const router = useRouter();
  const confirm = useConfirmDialog();
  const [pending, startTransition] = useTransition();
  const [logOpen, setLogOpen] = useState(false);

  const remove = async (v: VisitDTO) => {
    const { confirmed } = await confirm({
      title: "Delete visit?",
      description: "This visit record will be removed.",
      confirmLabel: "Delete",
      tone: "destructive",
    });
    if (!confirmed) return;
    startTransition(async () => {
      const res = await deleteVisit(v.id, prospectId);
      if ("error" in res) { toast.error(res.error); return; }
      toast.success("Visit deleted");
      router.refresh();
    });
  };

  return (
    <div className="rounded-2xl border border-border-default bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-fg">Visits</h3>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<PlusIcon className="h-4 w-4" />}
          onClick={() => setLogOpen(true)}
        >
          Log visit
        </Button>
      </div>

      {visits.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-default p-5 text-center">
          <MapPinIcon className="mx-auto h-7 w-7 text-fg-tertiary/50" />
          <p className="mt-1 text-sm text-fg-tertiary">No visits logged yet.</p>
        </div>
      ) : (
        <ol className="relative space-y-4 ps-5">
          <span className="absolute inset-y-1 start-[5px] w-px bg-border-default" aria-hidden="true" />
          {visits.map((v) => (
            <li key={v.id} className="relative">
              <span className="absolute -start-5 top-1.5 h-2.5 w-2.5 rounded-full bg-brand-400 ring-4 ring-surface" />
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-fg">{fmtDate(v.visitDate)}</span>
                  <Badge tone="info" appearance="subtle" size="sm">
                    Met: {WHO_MET_LABELS[v.whoMet] ?? v.whoMet}
                  </Badge>
                </div>
                <button
                  type="button"
                  onClick={() => remove(v)}
                  disabled={pending}
                  className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-fg-tertiary hover:bg-error-50 hover:text-error-600 disabled:opacity-50"
                  title="Delete visit"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
              {v.outcomeNotes && <p className="mt-1 text-sm text-fg-secondary">{v.outcomeNotes}</p>}
              {v.objectionRaised && (
                <p className="mt-1.5 flex items-start gap-1.5 rounded-md bg-warning-50 px-2 py-1 text-xs text-warning-800">
                  <HandRaisedIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  <span><span className="font-semibold">Objection:</span> {v.objectionRaised}</span>
                </p>
              )}
              {v.nextAction && (
                <p className="mt-1.5 flex items-start gap-1.5 text-xs text-fg-secondary">
                  <ArrowRightCircleIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-brand-500" />
                  <span><span className="font-semibold">Next:</span> {v.nextAction}</span>
                </p>
              )}
            </li>
          ))}
        </ol>
      )}

      <LogVisitModal
        open={logOpen}
        onClose={() => setLogOpen(false)}
        prospectId={prospectId}
        stage={stage}
      />
    </div>
  );
}
