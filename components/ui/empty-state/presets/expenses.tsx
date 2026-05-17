"use client";

import {
  CheckCircleIcon,
  ClipboardDocumentListIcon,
} from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";
import { EmptyState } from "../EmptyState";

export function NoExpensesPending({
  onViewApproved,
}: {
  onViewApproved?: () => void;
}) {
  const t = useTranslations("emptyState.expenses.pending");
  return (
    <EmptyState
      variant="positive"
      illustration={<CheckCircleIcon />}
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
      illustration={<ClipboardDocumentListIcon />}
      title={t("title")}
      description={t("description")}
      primaryAction={{ label: t("primary"), onClick: onClearFilters }}
    />
  );
}
