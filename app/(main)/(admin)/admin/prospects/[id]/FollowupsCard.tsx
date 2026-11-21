"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  PlusIcon,
  TrashIcon,
  SparklesIcon,
  ChatBubbleLeftRightIcon,
} from "@heroicons/react/24/outline";
import {
  Badge,
  Button,
  TextField,
  TextArea,
  Select,
  useConfirmDialog,
} from "@/components/ui";
import { CHANNELS } from "../../_lib/crm-options";
import { fmtDate, dueState } from "../../_lib/format";
import { waLink } from "@/utils/whatsapp";
import {
  addFollowup,
  toggleFollowup,
  deleteFollowup,
  seedFollowupRhythm,
} from "../actions";
import type { FollowupDTO } from "./page";

export default function FollowupsCard({
  prospectId,
  phone,
  followups,
}: {
  prospectId: string;
  phone: string | null;
  followups: FollowupDTO[];
}) {
  const router = useRouter();
  const t = useTranslations("admin");
  const confirm = useConfirmDialog();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [channel, setChannel] = useState("WHATSAPP");
  const [purpose, setPurpose] = useState("");

  const open = followups.filter((f) => !f.completed);
  const done = followups.filter((f) => f.completed).reverse();

  const refresh = () => router.refresh();

  const DueBadge = ({ iso, completed }: { iso: string; completed: boolean }) => {
    if (completed) return <Badge tone="success" appearance="subtle" size="sm">{t("followups.badge.done")}</Badge>;
    const state = dueState(iso);
    if (state === "overdue") return <Badge tone="danger" appearance="solid" size="sm">{t("followups.badge.overdue")}</Badge>;
    if (state === "today") return <Badge tone="warning" appearance="solid" size="sm">{t("followups.badge.today")}</Badge>;
    return <Badge tone="neutral" appearance="subtle" size="sm">{t("followups.badge.upcoming")}</Badge>;
  };

  const submitAdd = () => {
    if (!dueDate) {
      toast.error(t("followups.pickDate"));
      return;
    }
    const fd = new FormData();
    fd.set("prospectId", prospectId);
    fd.set("dueDate", dueDate);
    fd.set("channel", channel);
    fd.set("purpose", purpose);
    startTransition(async () => {
      const res = await addFollowup(fd);
      if ("error" in res) { toast.error(res.error); return; }
      toast.success(t("followups.added"));
      setAdding(false);
      setDueDate("");
      setPurpose("");
      setChannel("WHATSAPP");
      refresh();
    });
  };

  const toggle = (f: FollowupDTO) =>
    startTransition(async () => {
      const res = await toggleFollowup(f.id, prospectId, !f.completed);
      if ("error" in res) { toast.error(res.error); return; }
      refresh();
    });

  const remove = async (f: FollowupDTO) => {
    const { confirmed } = await confirm({
      title: t("followups.deleteDialog.title"),
      description: f.purpose ?? t("followups.deleteDialog.descFallback"),
      confirmLabel: t("followups.deleteDialog.confirm"),
      tone: "destructive",
    });
    if (!confirmed) return;
    startTransition(async () => {
      const res = await deleteFollowup(f.id, prospectId);
      if ("error" in res) { toast.error(res.error); return; }
      toast.success(t("followups.deleted"));
      refresh();
    });
  };

  const seed = () =>
    startTransition(async () => {
      const res = await seedFollowupRhythm(prospectId);
      if ("error" in res) { toast.error(res.error); return; }
      toast.success(t("followups.rhythmAdded"));
      refresh();
    });

  const Row = ({ f }: { f: FollowupDTO }) => {
    const wa = f.channel === "WHATSAPP" ? waLink(phone, f.purpose ?? undefined) : null;
    return (
      <li className="flex items-start gap-3 py-2.5">
        <input
          type="checkbox"
          checked={f.completed}
          onChange={() => toggle(f)}
          disabled={pending}
          className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-border-default text-brand-500 focus:ring-brand-500"
          aria-label={f.completed ? "Mark incomplete" : "Mark complete"}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <DueBadge iso={f.dueDate} completed={f.completed} />
            <Badge tone="neutral" appearance="outline" size="sm">
              {t(`enums.channel.${f.channel}`)}
            </Badge>
            <span className="text-xs text-fg-tertiary">{fmtDate(f.dueDate)}</span>
          </div>
          <p className={`mt-0.5 text-sm ${f.completed ? "text-fg-tertiary line-through" : "text-fg"}`}>
            {f.purpose ?? "—"}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-success-600 hover:bg-success-50"
              title={t("followups.openWhatsapp")}
            >
              <ChatBubbleLeftRightIcon className="h-4 w-4" />
            </a>
          )}
          <button
            type="button"
            onClick={() => remove(f)}
            disabled={pending}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-tertiary hover:bg-error-50 hover:text-error-600 disabled:opacity-50"
            title={t("common.delete")}
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </li>
    );
  };

  return (
    <div className="rounded-2xl border border-border-default bg-surface p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-fg">{t("followups.title")}</h3>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<PlusIcon className="h-4 w-4" />}
          onClick={() => setAdding((v) => !v)}
        >
          {t("followups.add")}
        </Button>
      </div>

      {adding && (
        <div className="mb-3 space-y-2 rounded-lg border border-border-default bg-canvas p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <TextField
              label={t("followups.dueDate")}
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              reserveMessageSpace={false}
            />
            <Select
              label={t("followups.channel")}
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              options={CHANNELS.map((v) => ({ value: v, label: t(`enums.channel.${v}`) }))}
              reserveMessageSpace={false}
            />
          </div>
          <TextArea
            label={t("followups.purpose")}
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            rows={2}
            reserveMessageSpace={false}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)} disabled={pending}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" size="sm" onClick={submitAdd} loading={pending}>
              {t("followups.addFollowup")}
            </Button>
          </div>
        </div>
      )}

      {followups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-default p-4 text-center">
          <p className="text-sm text-fg-tertiary">{t("followups.noneYet")}</p>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<SparklesIcon className="h-4 w-4" />}
            onClick={seed}
            loading={pending}
            className="mt-1"
          >
            {t("followups.addRhythm")}
          </Button>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-border-subtle">
            {open.map((f) => (
              <Row key={f.id} f={f} />
            ))}
          </ul>
          {done.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-medium text-fg-tertiary">
                {t("followups.completed", { count: done.length })}
              </summary>
              <ul className="divide-y divide-border-subtle">
                {done.map((f) => (
                  <Row key={f.id} f={f} />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
