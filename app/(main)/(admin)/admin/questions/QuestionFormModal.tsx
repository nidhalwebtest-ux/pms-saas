"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  TextArea,
  Select,
  NumberField,
  SearchableSelect,
} from "@/components/ui";
import { QUESTION_CATEGORIES } from "../_lib/crm-options";
import { createQuestion, updateQuestion } from "./actions";
import type { ProspectOption, QuestionRow } from "./page";

type Values = {
  question: string;
  category: string;
  answer: string;
  notes: string;
  timesAsked: number | null;
  prospectId: string;
};

function initialValues(q?: QuestionRow | null): Values {
  return {
    question: q?.question ?? "",
    category: q?.category ?? "OTHER",
    answer: q?.answer ?? "",
    notes: q?.notes ?? "",
    timesAsked: q?.timesAsked ?? 1,
    prospectId: q?.prospectId ?? "",
  };
}

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-tertiary">{children}</h3>
);

export default function QuestionFormModal({
  open,
  onClose,
  question,
  prospects,
}: {
  open: boolean;
  onClose: () => void;
  question?: QuestionRow | null;
  prospects: ProspectOption[];
}) {
  const router = useRouter();
  const t = useTranslations("admin");
  const isEdit = !!question;
  const [v, setV] = useState<Values>(() => initialValues(question));
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof Values>(key: K, value: Values[K]) =>
    setV((prev) => ({ ...prev, [key]: value }));

  const submit = () => {
    if (!v.question.trim()) {
      toast.error(t("questions.form.requiredQuestion"));
      return;
    }
    const fd = new FormData();
    if (question) fd.set("id", question.id);
    fd.set("question", v.question);
    fd.set("category", v.category);
    fd.set("answer", v.answer);
    fd.set("notes", v.notes);
    fd.set("timesAsked", String(v.timesAsked ?? 1));
    fd.set("prospectId", v.prospectId);

    startTransition(async () => {
      const res = isEdit ? await updateQuestion(fd) : await createQuestion(fd);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(isEdit ? t("questions.toast.updated") : t("questions.toast.added"));
      router.refresh();
      onClose();
    });
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" variant="centered">
      <ModalHeader
        title={isEdit ? t("questions.form.editTitle") : t("questions.form.addTitle")}
        subtitle={t("questions.form.subtitle")}
      />
      <ModalBody>
        <div className="space-y-6">
          {/* ── The question ───────────────────────────────────────── */}
          <section className="space-y-3">
            <SectionTitle>{t("questions.form.sections.question")}</SectionTitle>
            <TextArea
              label={t("questions.form.question")}
              required
              minRows={2}
              maxLength={1000}
              value={v.question}
              onChange={(e) => set("question", e.target.value)}
              placeholder={t("questions.form.questionPh")}
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <Select
                label={t("questions.form.category")}
                value={v.category}
                onChange={(e) => set("category", e.target.value)}
                options={QUESTION_CATEGORIES.map((c) => ({ value: c, label: t(`enums.questionCategory.${c}`) }))}
              />
              <NumberField
                label={t("questions.form.timesAsked")}
                min={1}
                step={1}
                precision={0}
                value={v.timesAsked}
                onValueChange={(n) => set("timesAsked", n)}
              />
              <SearchableSelect
                label={t("questions.form.askedBy")}
                showOptional
                value={v.prospectId || null}
                onValueChange={(id) => set("prospectId", id ?? "")}
                options={prospects.map((p) => ({ value: p.id, label: p.businessName }))}
                placeholder={t("questions.form.askedByPh")}
                emptyText={t("questions.form.askedByEmpty")}
              />
            </div>
            <TextArea
              label={t("questions.form.notes")}
              showOptional
              minRows={2}
              value={v.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder={t("questions.form.notesPh")}
            />
          </section>

          {/* ── The answer ─────────────────────────────────────────── */}
          <section className="space-y-3">
            <SectionTitle>{t("questions.form.sections.answer")}</SectionTitle>
            <TextArea
              label={t("questions.form.answer")}
              showOptional
              minRows={4}
              maxRows={14}
              value={v.answer}
              onChange={(e) => set("answer", e.target.value)}
              placeholder={t("questions.form.answerPh")}
              helperText={t("questions.form.answerHelp")}
            />
          </section>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose} disabled={pending}>
          {t("common.cancel")}
        </Button>
        <Button variant="primary" onClick={submit} loading={pending}>
          {t("common.save")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
