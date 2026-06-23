"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChatBubbleLeftRightIcon, CheckIcon } from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { Badge, EmptyState } from "@/components/ui";
import { fmtDate, dueState } from "../_lib/format";
import { waLink } from "@/utils/whatsapp";
import { toggleFollowup } from "../prospects/actions";
import type { QueueItem } from "./page";

function QueueRow({ item, pending, onComplete }: {
  item: QueueItem;
  pending: boolean;
  onComplete: (item: QueueItem) => void;
}) {
  const t = useTranslations("admin");
  const wa = item.channel === "WHATSAPP" ? waLink(item.phone, item.purpose ?? undefined) : null;
  const overdue = dueState(item.dueDate) === "overdue";

  return (
    <li className="flex items-start gap-3 rounded-xl border border-border-default bg-surface p-3 sm:items-center">
      <button
        type="button"
        onClick={() => onComplete(item)}
        disabled={pending}
        title={t("queue.markComplete")}
        className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-border-default text-fg-tertiary transition-colors hover:border-success-500 hover:bg-success-50 hover:text-success-600 disabled:opacity-50 sm:mt-0"
      >
        <CheckIcon className="h-4 w-4" />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href={`/admin/prospects/${item.prospectId}`}
            className="text-sm font-semibold text-fg hover:text-brand-600"
          >
            {item.businessName}
          </Link>
          <Badge tone="neutral" appearance="outline" size="sm">
            {t(`enums.channel.${item.channel}`)}
          </Badge>
          {overdue ? (
            <Badge tone="danger" appearance="solid" size="sm">{t("followups.badge.overdue")} · {fmtDate(item.dueDate)}</Badge>
          ) : (
            <Badge tone="warning" appearance="solid" size="sm">{t("followups.badge.today")}</Badge>
          )}
        </div>
        <p className="mt-0.5 text-sm text-fg-secondary">{item.purpose ?? "—"}</p>
      </div>

      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-success-50 px-2.5 py-1.5 text-xs font-semibold text-success-700 hover:bg-success-100"
        >
          <ChatBubbleLeftRightIcon className="h-4 w-4" />
          <span className="hidden sm:inline">{t("queue.whatsapp")}</span>
        </a>
      )}
    </li>
  );
}

export default function FollowupQueue({ items }: { items: QueueItem[] }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const overdue = items.filter((i) => dueState(i.dueDate) === "overdue");
  const today = items.filter((i) => dueState(i.dueDate) !== "overdue");

  const complete = (item: QueueItem) =>
    startTransition(async () => {
      const res = await toggleFollowup(item.id, item.prospectId, true);
      if ("error" in res) { toast.error(res.error); return; }
      toast.success(t("common.done"));
      router.refresh();
    });

  if (items.length === 0) {
    return (
      <EmptyState
        variant="positive"
        illustration={<CheckCircleIcon className="h-12 w-12 text-success-500" />}
        title={t("queue.allCaught")}
        description={t("queue.allCaughtDesc")}
      />
    );
  }

  return (
    <div className="space-y-5">
      {overdue.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-error-600">
            {t("queue.overdue", { count: overdue.length })}
          </h3>
          <ul className="space-y-2">
            {overdue.map((i) => (
              <QueueRow key={i.id} item={i} pending={pending} onComplete={complete} />
            ))}
          </ul>
        </section>
      )}

      {today.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-warning-700">
            {t("queue.dueToday", { count: today.length })}
          </h3>
          <ul className="space-y-2">
            {today.map((i) => (
              <QueueRow key={i.id} item={i} pending={pending} onComplete={complete} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
