"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowPathIcon,
  ClipboardDocumentIcon,
  ChatBubbleLeftRightIcon,
} from "@heroicons/react/24/outline";
import type { SortingState } from "@tanstack/react-table";
import { DataTable, EmptyState, Button, useConfirmDialog } from "@/components/ui";
import { buildQuestionColumns, questionRowVariant } from "./columns";
import QuestionFormModal from "./QuestionFormModal";
import { deleteQuestion, markAskedAgain } from "./actions";
import type { ProspectOption, QuestionRow } from "./page";

export default function QuestionsView({
  questions,
  hasAnyQuestions,
  prospects,
}: {
  questions: QuestionRow[];
  hasAnyQuestions: boolean;
  prospects: ProspectOption[];
}) {
  const router = useRouter();
  const t = useTranslations("admin");
  const confirm = useConfirmDialog();
  const [, startTransition] = useTransition();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<QuestionRow | null>(null);
  const [sorting, setSorting] = useState<SortingState>([{ id: "timesAsked", desc: true }]);

  const columns = useMemo(() => buildQuestionColumns(t), [t]);

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (q: QuestionRow) => {
    setEditing(q);
    setModalOpen(true);
  };

  const handleAskedAgain = (q: QuestionRow) => {
    startTransition(async () => {
      const res = await markAskedAgain(q.id);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(t("questions.toast.askedAgain", { count: q.timesAsked + 1 }));
      router.refresh();
    });
  };

  const handleCopy = async (q: QuestionRow) => {
    try {
      await navigator.clipboard.writeText(`${q.question}\n\n${q.answer ?? ""}`.trim());
      toast.success(t("questions.toast.copied"));
    } catch {
      toast.error(t("questions.toast.copyFailed"));
    }
  };

  const handleDelete = async (q: QuestionRow) => {
    const { confirmed } = await confirm({
      title: t("questions.deleteDialog.title"),
      description: t("questions.deleteDialog.desc"),
      confirmLabel: t("questions.deleteDialog.confirm"),
      tone: "destructive",
    });
    if (!confirmed) return;
    startTransition(async () => {
      const res = await deleteQuestion(q.id);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(t("questions.toast.deleted"));
      router.refresh();
    });
  };

  const rowActions = useMemo(
    () => (q: QuestionRow) => [
      {
        id: "edit",
        label: q.answer ? t("common.edit") : t("questions.writeAnswer"),
        icon: <PencilSquareIcon className="h-4 w-4" />,
        onClick: () => openEdit(q),
      },
      {
        id: "askedAgain",
        label: t("questions.askedAgain"),
        icon: <ArrowPathIcon className="h-4 w-4" />,
        onClick: () => handleAskedAgain(q),
      },
      {
        id: "copy",
        label: t("questions.copyAnswer"),
        icon: <ClipboardDocumentIcon className="h-4 w-4" />,
        visible: !!q.answer,
        onClick: () => handleCopy(q),
      },
      {
        id: "delete",
        label: t("common.delete"),
        icon: <TrashIcon className="h-4 w-4" />,
        variant: "destructive" as const,
        onClick: () => handleDelete(q),
      },
    ],
    [t],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-fg-tertiary">
          {t("common.shownCount", { count: questions.length })}
        </span>
        <Button variant="primary" size="sm" leftIcon={<PlusIcon className="h-4 w-4" />} onClick={openAdd}>
          {t("questions.addQuestion")}
        </Button>
      </div>

      <DataTable<QuestionRow>
        data={questions}
        columns={columns}
        mode="client"
        sorting={{ state: sorting, onChange: setSorting }}
        rowActions={rowActions}
        rowVariant={questionRowVariant}
        onRowClick={openEdit}
        emptyState={
          hasAnyQuestions ? (
            <EmptyState
              variant="exploratory"
              title={t("questions.empty.noMatchTitle")}
              description={t("questions.empty.noMatchDesc")}
            />
          ) : (
            <EmptyState
              variant="encouraging"
              illustration={<ChatBubbleLeftRightIcon className="h-12 w-12 text-brand-300" />}
              title={t("questions.empty.firstTitle")}
              description={t("questions.empty.firstDesc")}
              primaryAction={{
                label: t("questions.addQuestion"),
                onClick: openAdd,
                icon: <PlusIcon className="h-4 w-4" />,
              }}
            />
          )
        }
        aria-label={t("questions.table")}
      />

      {/* Mounted only while open + keyed so the form re-initializes per question. */}
      {modalOpen && (
        <QuestionFormModal
          key={editing?.id ?? "new"}
          open
          onClose={() => setModalOpen(false)}
          question={editing}
          prospects={prospects}
        />
      )}
    </div>
  );
}
