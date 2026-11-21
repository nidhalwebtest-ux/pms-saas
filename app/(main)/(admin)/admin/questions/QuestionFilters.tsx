"use client";

import { useTranslations } from "next-intl";
import { FilterBar, type QuickFilter } from "@/components/ui";
import { useFilterParams } from "@/hooks/useFilterParams";
import { QUESTION_CATEGORIES } from "../_lib/crm-options";

interface Props {
  currentSearch: string;
  currentStatus: string; // all | unanswered | answered
  currentCategory: string;
  counts: { all: number; unanswered: number; answered: number };
}

export default function QuestionFilters({ currentSearch, currentStatus, currentCategory, counts }: Props) {
  const t = useTranslations("admin");
  const [, setFilters] = useFilterParams({
    q: { default: "", serialize: "raw" },
    status: { default: "all", serialize: "raw" },
    category: { default: "", serialize: "raw" },
  });

  const statusTabs: QuickFilter[] = [
    { id: "all", label: t("questions.filters.all"), count: counts.all },
    { id: "unanswered", label: t("questions.filters.unanswered"), count: counts.unanswered },
    { id: "answered", label: t("questions.filters.answered"), count: counts.answered },
  ];

  return (
    <FilterBar
      search={{
        value: currentSearch,
        onChange: (q) => setFilters({ q }),
        placeholder: t("questions.filters.search"),
      }}
      quickFilters={statusTabs}
      activeQuickFilter={currentStatus}
      onQuickFilterChange={(s) => setFilters({ status: s === "all" ? "" : s })}
      filters={[
        {
          id: "category",
          type: "select",
          label: t("questions.filters.category"),
          value: currentCategory || "",
          allValue: "",
          onChange: (category) => setFilters({ category }),
          options: [
            { value: "", label: t("questions.filters.allCategories") },
            ...QUESTION_CATEGORIES.map((v) => ({ value: v, label: t(`enums.questionCategory.${v}`) })),
          ],
        },
      ]}
      activeFiltersDisplay="chips"
      onClearAll={() => setFilters({ category: "" })}
    />
  );
}
