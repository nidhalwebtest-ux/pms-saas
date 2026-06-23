"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { TrashIcon } from "@heroicons/react/24/outline";
import { TextArea, Button } from "@/components/ui";
import { updateNotes } from "../actions";

export default function NotesCard({
  prospectId,
  notes,
}: {
  prospectId: string;
  notes: string | null;
}) {
  const router = useRouter();
  const t = useTranslations("admin");
  const [value, setValue] = useState(notes ?? "");
  const [pending, startTransition] = useTransition();
  const dirty = value !== (notes ?? "");

  const save = () =>
    startTransition(async () => {
      const res = await updateNotes(prospectId, value);
      if ("error" in res) { toast.error(res.error); return; }
      toast.success(t("notes.saved"));
      router.refresh();
    });

  const clear = () =>
    startTransition(async () => {
      const res = await updateNotes(prospectId, "");
      if ("error" in res) { toast.error(res.error); return; }
      setValue("");
      toast.success(t("notes.cleared"));
      router.refresh();
    });

  return (
    <div className="rounded-2xl border border-border-default bg-surface p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-fg">{t("notes.title")}</h3>
        {(notes ?? "").trim() !== "" && (
          <button
            type="button"
            onClick={clear}
            disabled={pending}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-tertiary hover:bg-error-50 hover:text-error-600 disabled:opacity-50"
            title={t("notes.clear")}
            aria-label={t("notes.clear")}
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        )}
      </div>
      <TextArea
        label=""
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={4}
        placeholder={t("notes.placeholder")}
        reserveMessageSpace={false}
      />
      {dirty && (
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setValue(notes ?? "")} disabled={pending}>
            {t("notes.reset")}
          </Button>
          <Button variant="primary" size="sm" onClick={save} loading={pending}>
            {t("notes.save")}
          </Button>
        </div>
      )}
    </div>
  );
}
