"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
  const [value, setValue] = useState(notes ?? "");
  const [pending, startTransition] = useTransition();
  const dirty = value !== (notes ?? "");

  const save = () =>
    startTransition(async () => {
      const res = await updateNotes(prospectId, value);
      if ("error" in res) { toast.error(res.error); return; }
      toast.success("Notes saved");
      router.refresh();
    });

  return (
    <div className="rounded-2xl border border-border-default bg-surface p-4">
      <h3 className="mb-2 text-sm font-semibold text-fg">Quick notes</h3>
      <TextArea
        label=""
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={4}
        placeholder="Anything worth remembering about this prospect…"
        reserveMessageSpace={false}
      />
      {dirty && (
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setValue(notes ?? "")} disabled={pending}>
            Reset
          </Button>
          <Button variant="primary" size="sm" onClick={save} loading={pending}>
            Save notes
          </Button>
        </div>
      )}
    </div>
  );
}
