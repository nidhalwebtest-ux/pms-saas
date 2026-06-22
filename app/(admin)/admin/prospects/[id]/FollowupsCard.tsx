"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { CHANNELS, CHANNEL_LABELS, toOptions } from "../../_lib/crm-options";
import { fmtDate, dueState } from "../../_lib/format";
import { waLink } from "@/utils/whatsapp";
import {
  addFollowup,
  toggleFollowup,
  deleteFollowup,
  seedFollowupRhythm,
} from "../actions";
import type { FollowupDTO } from "./page";

function DueBadge({ iso, completed }: { iso: string; completed: boolean }) {
  if (completed) return <Badge tone="success" appearance="subtle" size="sm">Done</Badge>;
  const state = dueState(iso);
  if (state === "overdue") return <Badge tone="danger" appearance="solid" size="sm">Overdue</Badge>;
  if (state === "today") return <Badge tone="warning" appearance="solid" size="sm">Today</Badge>;
  return <Badge tone="neutral" appearance="subtle" size="sm">Upcoming</Badge>;
}

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
  const confirm = useConfirmDialog();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [channel, setChannel] = useState("WHATSAPP");
  const [purpose, setPurpose] = useState("");

  const open = followups.filter((f) => !f.completed);
  const done = followups.filter((f) => f.completed).reverse();

  const refresh = () => router.refresh();

  const submitAdd = () => {
    if (!dueDate) {
      toast.error("Pick a due date");
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
      toast.success("Follow-up added");
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
      title: "Delete follow-up?",
      description: f.purpose ?? "This follow-up will be removed.",
      confirmLabel: "Delete",
      tone: "destructive",
    });
    if (!confirmed) return;
    startTransition(async () => {
      const res = await deleteFollowup(f.id, prospectId);
      if ("error" in res) { toast.error(res.error); return; }
      toast.success("Deleted");
      refresh();
    });
  };

  const seed = () =>
    startTransition(async () => {
      const res = await seedFollowupRhythm(prospectId);
      if ("error" in res) { toast.error(res.error); return; }
      toast.success("Standard rhythm added");
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
              {CHANNEL_LABELS[f.channel] ?? f.channel}
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
              title="Open WhatsApp"
            >
              <ChatBubbleLeftRightIcon className="h-4 w-4" />
            </a>
          )}
          <button
            type="button"
            onClick={() => remove(f)}
            disabled={pending}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-tertiary hover:bg-error-50 hover:text-error-600 disabled:opacity-50"
            title="Delete"
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
        <h3 className="text-sm font-semibold text-fg">Follow-ups</h3>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<PlusIcon className="h-4 w-4" />}
          onClick={() => setAdding((v) => !v)}
        >
          Add
        </Button>
      </div>

      {adding && (
        <div className="mb-3 space-y-2 rounded-lg border border-border-default bg-canvas p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <TextField
              label="Due date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              reserveMessageSpace={false}
            />
            <Select
              label="Channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              options={toOptions(CHANNELS, CHANNEL_LABELS)}
              reserveMessageSpace={false}
            />
          </div>
          <TextArea
            label="Purpose"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            rows={2}
            reserveMessageSpace={false}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={submitAdd} loading={pending}>
              Add follow-up
            </Button>
          </div>
        </div>
      )}

      {followups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-default p-4 text-center">
          <p className="text-sm text-fg-tertiary">No follow-ups yet.</p>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<SparklesIcon className="h-4 w-4" />}
            onClick={seed}
            loading={pending}
            className="mt-1"
          >
            Add the standard rhythm
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
                Completed ({done.length})
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
