"use client";

import Link from "next/link";
import { Badge, defineColumns } from "@/components/ui";
import { questionCategoryBadge } from "../_lib/crm-options";
import { fmtDate } from "../_lib/format";
import type { QuestionRow } from "./page";

type Translator = (key: string, values?: Record<string, string | number>) => string;

/** Unanswered questions that keep coming back are the ones to answer first. */
export const FREQUENT_THRESHOLD = 3;

export function questionRowVariant(r: QuestionRow): "warning" | "default" {
  return !r.answer && r.timesAsked >= FREQUENT_THRESHOLD ? "warning" : "default";
}

export function buildQuestionColumns(t: Translator) {
  const c = defineColumns<QuestionRow>();

  return [
    /* ── Question + answer preview ───────────────────────────────── */
    c.custom<string>({
      id: "question",
      header: t("questions.columns.question"),
      accessorFn: (r) => r.question.toLowerCase(),
      sortingFn: "alphanumeric",
      meta: { mobile: "title" },
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="min-w-0 max-w-xl">
            <p className="whitespace-pre-line text-sm font-semibold text-fg">{r.question}</p>
            {r.answer ? (
              <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-xs text-fg-secondary">{r.answer}</p>
            ) : (
              <p className="mt-0.5 text-xs italic text-warning-700">{t("questions.noAnswerYet")}</p>
            )}
          </div>
        );
      },
    }),

    /* ── Category ────────────────────────────────────────────────── */
    c.custom<string>({
      id: "category",
      header: t("questions.columns.category"),
      accessorFn: (r) => r.category,
      meta: { mobile: "status" },
      cell: ({ row }) => (
        <Badge {...questionCategoryBadge(row.original.category)} size="sm">
          {t(`enums.questionCategory.${row.original.category}`)}
        </Badge>
      ),
    }),

    /* ── Times asked ─────────────────────────────────────────────── */
    c.custom<number>({
      id: "timesAsked",
      header: t("questions.columns.timesAsked"),
      accessorFn: (r) => r.timesAsked,
      sortingFn: "basic",
      meta: { align: "end", numeric: true },
      cell: ({ row }) => (
        <span className="tabular-nums text-sm font-semibold text-fg">×{row.original.timesAsked}</span>
      ),
    }),

    /* ── Asked by (first lead) ───────────────────────────────────── */
    c.custom<string>({
      id: "askedBy",
      header: t("questions.columns.askedBy"),
      accessorFn: (r) => (r.prospectName ?? "").toLowerCase(),
      sortingFn: "alphanumeric",
      cell: ({ row }) => {
        const r = row.original;
        return r.prospectId && r.prospectName ? (
          <Link
            href={`/admin/prospects/${r.prospectId}`}
            onClick={(e) => e.stopPropagation()}
            className="text-sm text-fg-secondary transition-colors hover:text-brand-600"
          >
            {r.prospectName}
          </Link>
        ) : (
          <span className="text-sm text-fg-tertiary">—</span>
        );
      },
    }),

    /* ── Last asked ──────────────────────────────────────────────── */
    c.custom<string>({
      id: "lastAskedAt",
      header: t("questions.columns.lastAsked"),
      accessorFn: (r) => r.lastAskedAt,
      sortingFn: "alphanumeric",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm text-fg-secondary">{fmtDate(row.original.lastAskedAt)}</span>
      ),
    }),
  ];
}
