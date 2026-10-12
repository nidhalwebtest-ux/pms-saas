import { Prisma } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";
import { prisma } from "@/lib/prisma";
import { QUESTION_CATEGORIES } from "../_lib/crm-options";
import QuestionFilters from "./QuestionFilters";
import QuestionsView from "./QuestionsView";

// One row carries everything the list, the edit modal, and the row actions need.
export type QuestionRow = {
  id: string;
  question: string;
  category: string;
  answer: string | null;
  notes: string | null;
  timesAsked: number;
  lastAskedAt: string; // ISO
  prospectId: string | null;
  prospectName: string | null;
  createdAt: string; // ISO
};

export type ProspectOption = { id: string; businessName: string };

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const t = await getTranslations("admin");
  const params = await searchParams;
  const q = params.q || "";
  const status = ["unanswered", "answered"].includes(params.status ?? "") ? params.status! : "all";
  const category = (QUESTION_CATEGORIES as readonly string[]).includes(params.category ?? "")
    ? params.category!
    : "";

  const where: Prisma.LeadQuestionWhereInput = {
    ...(q && {
      OR: [
        { question: { contains: q, mode: "insensitive" } },
        { answer: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } },
      ],
    }),
    ...(status === "unanswered" && { answer: null }),
    ...(status === "answered" && { answer: { not: null } }),
    ...(category && { category: category as never }),
  };

  const [raw, allCount, unansweredCount, prospects] = await Promise.all([
    prisma.leadQuestion.findMany({
      where,
      orderBy: [{ timesAsked: "desc" }, { lastAskedAt: "desc" }],
      take: 1000,
      include: { prospect: { select: { businessName: true } } },
    }),
    prisma.leadQuestion.count(),
    prisma.leadQuestion.count({ where: { answer: null } }),
    prisma.prospect.findMany({
      select: { id: true, businessName: true },
      orderBy: { businessName: "asc" },
      take: 1000,
    }),
  ]);

  const questions: QuestionRow[] = raw.map((r) => ({
    id: r.id,
    question: r.question,
    category: r.category,
    answer: r.answer,
    notes: r.notes,
    timesAsked: r.timesAsked,
    lastAskedAt: r.lastAskedAt.toISOString(),
    prospectId: r.prospectId,
    prospectName: r.prospect?.businessName ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <ChatBubbleLeftRightIcon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-xl font-bold text-fg">{t("questions.title")}</h2>
          <p className="text-sm text-fg-tertiary">{t("questions.subtitle", { count: allCount })}</p>
        </div>
      </div>

      <QuestionFilters
        currentSearch={q}
        currentStatus={status}
        currentCategory={category}
        counts={{ all: allCount, unanswered: unansweredCount, answered: allCount - unansweredCount }}
      />

      <QuestionsView questions={questions} hasAnyQuestions={allCount > 0} prospects={prospects} />
    </div>
  );
}
