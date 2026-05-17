"use client";

import { useTranslations } from "next-intl";
import { EmptyState } from "../EmptyState";
import { AllCaughtUp } from "../illustrations/AllCaughtUp";
import { NoExpenses } from "../illustrations/NoExpenses";

export function NoExpensesPending({
  onViewApproved,
}: {
  onViewApproved?: () => void;
}) {
  const t = useTranslations("emptyState.expenses.pending");
  return (
    <EmptyState
      variant="positive"
      illustration={<AllCaughtUp />}
      title={t("title")}
      description={t("description")}
      primaryAction={
        onViewApproved
          ? { label: t("primary"), onClick: onViewApproved }
          : undefined
      }
    />
  );
}

export function NoExpensesForFilters({
  onClearFilters,
}: {
  onClearFilters: () => void;
}) {
  const t = useTranslations("emptyState.expenses.filtered");
  return (
    <EmptyState
      variant="exploratory"
      illustration={<NoExpenses />}
      title={t("title")}
      description={t("description")}
      primaryAction={{ label: t("primary"), onClick: onClearFilters }}
    />
  );
}
