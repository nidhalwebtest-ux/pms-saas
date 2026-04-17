"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ChatBubbleLeftIcon,
  TrashIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/outline";
import { addUnitNote, deleteUnitNote } from "@/app/dashboard/units/[unitId]/actions";
import { useTranslations, useLocale } from "next-intl";
import { format } from "date-fns";
import { ar, enGB } from "date-fns/locale";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Note {
  id:        string;
  content:   string;
  createdAt: string;
  user: {
    id:        string;
    firstName: string | null;
    lastName:  string | null;
  };
}

interface Props {
  unitId:        string;
  notes:         Note[];
  currentUserId: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function useRelativeTime() {
  const t = useTranslations("units.notes");
  const locale = useLocale();
  const dfLocale = locale === "ar" ? ar : enGB;
  return (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins  = Math.floor(diff / 60_000);
    const hours = Math.floor(diff / 3_600_000);
    const days  = Math.floor(diff / 86_400_000);

    if (mins < 1)   return t("justNow");
    if (mins < 60)  return t("minsAgo",  { n: mins });
    if (hours < 24) return t("hoursAgo", { n: hours });
    if (days < 7)   return t("daysAgo",  { n: days });
    return format(new Date(dateStr), "dd MMM", { locale: dfLocale });
  };
}

function initials(firstName: string | null, lastName: string | null) {
  return [firstName?.[0], lastName?.[0]].filter(Boolean).join("").toUpperCase() || "?";
}

// ── Note Row ──────────────────────────────────────────────────────────────────

function NoteRow({
  note,
  canDelete,
}: {
  note:      Note;
  canDelete: boolean;
}) {
  const t = useTranslations("units.notes");
  const relativeTime = useRelativeTime();
  const [pending, startDelete] = useTransition();

  return (
    <div className="group flex gap-3">
      {/* Avatar */}
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
        {initials(note.user.firstName, note.user.lastName)}
      </div>

      {/* Content */}
      <div className="flex-1 rounded-xl bg-gray-50 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-gray-700">
            {[note.user.firstName, note.user.lastName].filter(Boolean).join(" ") || t("userFallback")}
          </span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400">{relativeTime(note.createdAt)}</span>
            {canDelete && (
              <button
                onClick={() =>
                  startDelete(async () => {
                    const res = await deleteUnitNote(note.id);
                    if (res.error) toast.error(res.error);
                    else toast.success(t("deletedToast"));
                  })
                }
                disabled={pending}
                className="ms-1 rounded p-0.5 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-50 hover:text-red-400"
                title={t("deleteTitle")}
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <p className="mt-0.5 text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function UnitNotesSection({ unitId, notes, currentUserId }: Props) {
  const t = useTranslations("units.notes");
  const [text, setText] = useState("");
  const [pending, startAdd] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    const fd = new FormData();
    fd.append("unitId",  unitId);
    fd.append("content", text.trim());
    startAdd(async () => {
      const res = await addUnitNote(fd);
      if (res.error) {
        toast.error(res.error);
      } else {
        setText("");
        toast.success(t("addedToast"));
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Notes list */}
      {notes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-8 text-center">
          <ChatBubbleLeftIcon className="mx-auto mb-2 h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-400">{t("emptyTitle")}</p>
          <p className="text-xs text-gray-400">{t("emptyBody")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <NoteRow
              key={note.id}
              note={note}
              canDelete={note.user.id === currentUserId}
            />
          ))}
        </div>
      )}

      {/* Add note form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("addPlaceholder")}
          rows={2}
          className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              handleSubmit(e as any);
            }
          }}
        />
        <button
          type="submit"
          disabled={pending || !text.trim()}
          className="self-end rounded-xl bg-blue-600 p-2.5 text-white hover:bg-blue-500 disabled:opacity-40 transition-colors"
          title={t("submitTitle")}
        >
          <PaperAirplaneIcon className="h-4 w-4" />
        </button>
      </form>
      <p className="text-xs text-gray-400">{t("submitHint")}</p>
    </div>
  );
}
